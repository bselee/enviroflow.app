"""
Live App Test Runner
====================
Autonomous test-fix-repeat loop with intelligent escalation.
Drop this in your project or use as reference for Claude Code.
"""

import os
import time
import json
from datetime import datetime
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Any
from playwright.sync_api import sync_playwright, Page


@dataclass
class TestResult:
    """Result of a single test execution."""
    name: str
    success: bool
    duration: float
    error: Optional[str] = None
    screenshot: Optional[str] = None
    data_verification: Optional[Dict] = None
    console_logs: List[Dict] = field(default_factory=list)
    network_failures: List[Dict] = field(default_factory=list)


@dataclass 
class IterationResult:
    """Result of a fix attempt iteration."""
    iteration: int
    test_result: TestResult
    diagnosis: Optional[str] = None
    fix_applied: Optional[str] = None
    confidence: str = "unknown"  # high, medium, low


@dataclass
class FixLoopResult:
    """Final result of test-fix-repeat loop."""
    success: bool
    total_iterations: int
    elapsed_time: float
    iterations: List[IterationResult]
    final_test: TestResult
    escalation_needed: bool = False
    escalation_question: Optional[str] = None


class LiveAppTester:
    """
    Test runner that implements autonomous test-fix-repeat loops.
    
    Usage:
        tester = LiveAppTester(app_url="http://localhost:3000")
        
        result = tester.run_with_fix_loop(
            test_fn=my_test_function,
            fix_fn=my_fix_function,  # Called when test fails
            max_iterations=5
        )
    """
    
    def __init__(
        self,
        app_url: str = None,
        supabase_url: str = None,
        supabase_key: str = None,
        headless: bool = True,
        screenshot_dir: str = "/tmp/test-screenshots"
    ):
        self.app_url = app_url or os.getenv("LOCAL_APP_URL", "http://localhost:3000")
        self.supabase_url = supabase_url or os.getenv("SUPABASE_URL")
        self.supabase_key = supabase_key or os.getenv("SUPABASE_SERVICE_KEY")
        self.headless = headless
        self.screenshot_dir = screenshot_dir
        os.makedirs(screenshot_dir, exist_ok=True)
        
        self._supabase = None
    
    @property
    def supabase(self):
        """Lazy-load Supabase client."""
        if self._supabase is None and self.supabase_url and self.supabase_key:
            from supabase import create_client
            self._supabase = create_client(self.supabase_url, self.supabase_key)
        return self._supabase
    
    def run_test(
        self,
        test_fn: Callable[[Page, str], Dict],
        test_name: str = "unnamed_test"
    ) -> TestResult:
        """
        Run a single test with full diagnostic capture.
        
        Args:
            test_fn: Function that takes (page, url) and returns {"success": bool, ...}
            test_name: Name for reporting
        
        Returns:
            TestResult with all diagnostic info
        """
        start_time = time.time()
        console_logs = []
        network_failures = []
        screenshot_path = None
        
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=self.headless)
            context = browser.new_context(viewport={"width": 1280, "height": 720})
            page = context.new_page()
            
            # Set up diagnostic capture
            page.on("console", lambda msg: console_logs.append({
                "type": msg.type,
                "text": msg.text
            }))
            page.on("requestfailed", lambda req: network_failures.append({
                "url": req.url,
                "failure": str(req.failure)
            }))
            
            try:
                result = test_fn(page, self.app_url)
                success = result.get("success", False)
                error = result.get("error") if not success else None
                
                # Screenshot on failure
                if not success:
                    screenshot_path = f"{self.screenshot_dir}/{test_name}-{int(time.time())}.png"
                    page.screenshot(path=screenshot_path, full_page=True)
                
                return TestResult(
                    name=test_name,
                    success=success,
                    duration=time.time() - start_time,
                    error=error,
                    screenshot=screenshot_path,
                    data_verification=result.get("data_verification"),
                    console_logs=console_logs,
                    network_failures=network_failures
                )
                
            except Exception as e:
                screenshot_path = f"{self.screenshot_dir}/{test_name}-error-{int(time.time())}.png"
                try:
                    page.screenshot(path=screenshot_path, full_page=True)
                except:
                    pass
                
                return TestResult(
                    name=test_name,
                    success=False,
                    duration=time.time() - start_time,
                    error=str(e),
                    screenshot=screenshot_path,
                    console_logs=console_logs,
                    network_failures=network_failures
                )
            finally:
                browser.close()
    
    def verify_data(
        self,
        table: str,
        conditions: Dict[str, Any],
        expected: Dict[str, Any]
    ) -> Dict:
        """
        Verify database state matches expected values.
        
        Args:
            table: Supabase table name
            conditions: Filter conditions {column: value}
            expected: Expected values {column: value}
        
        Returns:
            {"success": bool, "actual": data, "diff": differences}
        """
        if not self.supabase:
            return {"success": False, "error": "Supabase not configured"}
        
        query = self.supabase.table(table).select("*")
        for col, val in conditions.items():
            query = query.eq(col, val)
        
        result = query.execute()
        actual = result.data[0] if result.data else None
        
        if not actual:
            return {
                "success": False,
                "actual": None,
                "expected": expected,
                "error": "No matching record found"
            }
        
        diff = {}
        for key, exp_val in expected.items():
            if actual.get(key) != exp_val:
                diff[key] = {"expected": exp_val, "actual": actual.get(key)}
        
        return {
            "success": len(diff) == 0,
            "actual": actual,
            "expected": expected,
            "diff": diff if diff else None
        }
    
    def run_with_fix_loop(
        self,
        test_fn: Callable[[Page, str], Dict],
        fix_fn: Callable[[TestResult, int], Dict],
        test_name: str = "unnamed_test",
        max_iterations: int = 5,
        max_same_error: int = 3
    ) -> FixLoopResult:
        """
        Run test with autonomous fix-retry loop.
        
        Args:
            test_fn: Test function (page, url) -> {"success": bool, ...}
            fix_fn: Fix function (test_result, iteration) -> {"applied": str, "confidence": str}
                    Returns None if cannot diagnose/fix
            test_name: Name for reporting
            max_iterations: Max total fix attempts
            max_same_error: Max attempts for identical error
        
        Returns:
            FixLoopResult with full iteration history
        """
        start_time = time.time()
        iterations: List[IterationResult] = []
        error_counts: Dict[str, int] = {}
        
        for i in range(max_iterations):
            # Run test
            test_result = self.run_test(test_fn, f"{test_name}_iter{i+1}")
            
            if test_result.success:
                return FixLoopResult(
                    success=True,
                    total_iterations=i + 1,
                    elapsed_time=time.time() - start_time,
                    iterations=iterations,
                    final_test=test_result
                )
            
            # Track error frequency
            error_key = test_result.error or "unknown"
            error_counts[error_key] = error_counts.get(error_key, 0) + 1
            
            # Check if stuck on same error
            if error_counts[error_key] >= max_same_error:
                return FixLoopResult(
                    success=False,
                    total_iterations=i + 1,
                    elapsed_time=time.time() - start_time,
                    iterations=iterations,
                    final_test=test_result,
                    escalation_needed=True,
                    escalation_question=self._generate_escalation_question(
                        test_result, iterations, "repeated_error"
                    )
                )
            
            # Attempt fix
            fix_result = fix_fn(test_result, i + 1)
            
            if fix_result is None:
                # Cannot diagnose - escalate
                return FixLoopResult(
                    success=False,
                    total_iterations=i + 1,
                    elapsed_time=time.time() - start_time,
                    iterations=iterations,
                    final_test=test_result,
                    escalation_needed=True,
                    escalation_question=self._generate_escalation_question(
                        test_result, iterations, "cannot_diagnose"
                    )
                )
            
            iterations.append(IterationResult(
                iteration=i + 1,
                test_result=test_result,
                diagnosis=fix_result.get("diagnosis"),
                fix_applied=fix_result.get("applied"),
                confidence=fix_result.get("confidence", "medium")
            ))
        
        # Max iterations reached
        final_result = self.run_test(test_fn, f"{test_name}_final")
        return FixLoopResult(
            success=final_result.success,
            total_iterations=max_iterations,
            elapsed_time=time.time() - start_time,
            iterations=iterations,
            final_test=final_result,
            escalation_needed=not final_result.success,
            escalation_question=self._generate_escalation_question(
                final_result, iterations, "max_iterations"
            ) if not final_result.success else None
        )
    
    def _generate_escalation_question(
        self,
        test_result: TestResult,
        iterations: List[IterationResult],
        reason: str
    ) -> str:
        """Generate a high-quality escalation question."""
        
        # Build context from iterations
        attempts_summary = "\n".join([
            f"  {i+1}. {it.fix_applied or 'No fix'} → {it.test_result.error or 'Unknown error'}"
            for i, it in enumerate(iterations[-3:])  # Last 3 attempts
        ])
        
        templates = {
            "repeated_error": f"""## Issue
Same error persisting after {len([it for it in iterations if it.test_result.error == test_result.error])} fix attempts.

## What I Tried
{attempts_summary}

## Current Error
{test_result.error}

## Console Output
{json.dumps(test_result.console_logs[-5:], indent=2) if test_result.console_logs else 'None'}

## Specific Question
What am I missing about why this error keeps occurring? Is there external state, configuration, or a dependency I should check?""",
            
            "cannot_diagnose": f"""## Issue
Test failing but unable to determine root cause.

## Error
{test_result.error}

## Network Failures
{json.dumps(test_result.network_failures, indent=2) if test_result.network_failures else 'None'}

## Console Output  
{json.dumps(test_result.console_logs[-5:], indent=2) if test_result.console_logs else 'None'}

## Screenshot
{test_result.screenshot}

## Specific Question
Can you help identify what's causing this failure? The error message isn't pointing to an obvious fix.""",
            
            "max_iterations": f"""## Issue
Unable to fix after {len(iterations)} iterations.

## Attempt History
{attempts_summary}

## Latest Error
{test_result.error}

## Specific Question
I've tried multiple approaches without success. Should I:
1. Try a completely different approach?
2. Is there a fundamental misunderstanding about how this feature should work?
3. Are there external factors (other components, state, timing) I should consider?"""
        }
        
        return templates.get(reason, f"Test failed: {test_result.error}")
    
    def generate_report(self, result: FixLoopResult) -> str:
        """Generate markdown report of test run."""
        status = "✅ PASSED" if result.success else "❌ FAILED"
        
        report = f"""## Test Run Report
**Status:** {status}
**Total Iterations:** {result.total_iterations}
**Elapsed Time:** {result.elapsed_time:.2f}s
**Timestamp:** {datetime.now().isoformat()}

### Final Test Result
- **Success:** {result.final_test.success}
- **Error:** {result.final_test.error or 'None'}
- **Screenshot:** {result.final_test.screenshot or 'N/A'}

### Iteration History
"""
        
        for it in result.iterations:
            report += f"""
#### Iteration {it.iteration}
- **Test Result:** {'✅' if it.test_result.success else '❌'} {it.test_result.error or 'Passed'}
- **Diagnosis:** {it.diagnosis or 'N/A'}
- **Fix Applied:** {it.fix_applied or 'N/A'}
- **Confidence:** {it.confidence}
"""
        
        if result.escalation_needed:
            report += f"""
### Escalation Required
{result.escalation_question}
"""
        
        return report


# =============================================================================
# Example Usage
# =============================================================================

def example_test(page: Page, url: str) -> Dict:
    """Example test function - test your feature here."""
    page.goto(f"{url}/dashboard")
    page.wait_for_load_state("networkidle")
    
    # Test: Click add button, modal should open
    page.click('[data-testid="add-item-btn"]')
    
    try:
        modal = page.wait_for_selector('[data-testid="item-modal"]', timeout=3000)
        if not modal.is_visible():
            return {"success": False, "error": "Modal not visible after click"}
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": f"Modal did not appear: {e}"}


def example_fix(test_result: TestResult, iteration: int) -> Optional[Dict]:
    """
    Example fix function - Claude Code would implement actual fixes here.
    
    Returns:
        Dict with {"applied": description, "confidence": high/medium/low}
        None if cannot diagnose
    """
    error = test_result.error or ""
    
    # Pattern matching for common fixes
    if "not visible" in error.lower():
        # Would actually modify code here
        return {
            "diagnosis": "Modal has display:none or visibility issue",
            "applied": "Check CSS for modal visibility rules",
            "confidence": "medium"
        }
    
    if "did not appear" in error.lower():
        # Would actually modify code here
        return {
            "diagnosis": "Click handler may not be triggering modal state",
            "applied": "Verify onClick handler is bound and calls setModalOpen(true)",
            "confidence": "high"
        }
    
    # Cannot diagnose
    return None


if __name__ == "__main__":
    # Example run
    tester = LiveAppTester(
        app_url="http://localhost:3000",
        headless=True
    )
    
    result = tester.run_with_fix_loop(
        test_fn=example_test,
        fix_fn=example_fix,
        test_name="modal_open_test",
        max_iterations=5
    )
    
    print(tester.generate_report(result))