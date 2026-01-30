---
name: live-app-tester
description: Test live application functionality via browser automation (Playwright) and database verification (Supabase). Use after making code changes to verify claims, prove functionality works, and iterate fixes autonomously. Supports test-fix-repeat loops with intelligent question escalation.
---

# Live App Testing

Verify code changes actually work by testing the live application through browser automation and database verification. Enables autonomous test-fix-repeat cycles.

## Core Philosophy

**Prove, don't assume.** After making code changes:
1. Test the actual UI behavior (Playwright)
2. Verify data state is correct (Supabase)
3. If broken → fix and repeat
4. If blocked → ask specific, valuable questions

## Prerequisites

### Playwright Setup

```bash
pip install playwright --break-system-packages
playwright install chromium
```

### Supabase Client

```bash
pip install supabase --break-system-packages
```

### Environment Variables

Ensure these are available (via .env, 1Password, or exports):

```bash
# App URLs
LOCAL_APP_URL="http://localhost:3000"
STAGING_APP_URL="https://staging.your-app.com"
PREVIEW_APP_URL="https://your-app-preview.vercel.app"

# Supabase
SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_SERVICE_KEY="eyJ..."  # Service role key for testing
```

---

## Testing Modes

### Mode 1: UI Verification (Playwright)

Test that UI behaves correctly after code changes.

```python
from playwright.sync_api import sync_playwright
import os

def test_ui(test_fn, app_url=None):
    """Wrapper for UI tests with automatic browser management."""
    url = app_url or os.getenv("LOCAL_APP_URL", "http://localhost:3000")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()
        
        try:
            result = test_fn(page, url)
            return {"success": True, "result": result}
        except Exception as e:
            # Capture screenshot on failure
            page.screenshot(path="/tmp/test-failure.png")
            return {"success": False, "error": str(e), "screenshot": "/tmp/test-failure.png"}
        finally:
            browser.close()
```

### Mode 2: Data Verification (Supabase)

Verify database state after operations.

```python
from supabase import create_client
import os

def get_supabase():
    """Get Supabase client with service role (bypasses RLS)."""
    return create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_KEY")
    )

def verify_data(table, conditions, expected):
    """
    Verify data matches expected state.
    
    Args:
        table: Table name
        conditions: Dict of column: value for filtering
        expected: Dict of column: value to verify, or callable
    
    Returns:
        {"success": bool, "actual": data, "expected": expected, "diff": differences}
    """
    sb = get_supabase()
    query = sb.table(table).select("*")
    
    for col, val in conditions.items():
        query = query.eq(col, val)
    
    result = query.execute()
    actual = result.data[0] if result.data else None
    
    if callable(expected):
        success = expected(actual)
        return {"success": success, "actual": actual}
    
    if not actual:
        return {"success": False, "actual": None, "expected": expected, "error": "No matching record"}
    
    diff = {}
    for key, exp_val in expected.items():
        if actual.get(key) != exp_val:
            diff[key] = {"expected": exp_val, "actual": actual.get(key)}
    
    return {"success": len(diff) == 0, "actual": actual, "expected": expected, "diff": diff}
```

### Mode 3: Combined UI + Data (Recommended)

Verify both UI behavior AND resulting data state.

```python
def test_feature_e2e(page, url, supabase_verification):
    """
    End-to-end test: UI action → verify data changed correctly.
    
    Args:
        page: Playwright page
        url: App URL
        supabase_verification: Dict with {table, conditions, expected}
    """
    # 1. Perform UI actions (implemented per test)
    ui_result = perform_ui_actions(page, url)
    
    if not ui_result["success"]:
        return {"success": False, "stage": "ui", "error": ui_result["error"]}
    
    # 2. Verify data state
    data_result = verify_data(**supabase_verification)
    
    if not data_result["success"]:
        return {"success": False, "stage": "data", "ui_passed": True, **data_result}
    
    return {"success": True, "ui_result": ui_result, "data_result": data_result}
```

---

## Test-Fix-Repeat Protocol

### Decision Tree

```
┌─────────────────────────────────────┐
│         Run Test Suite              │
└─────────────────┬───────────────────┘
                  │
                  ▼
         ┌───────────────┐
         │ All Passing?  │
         └───────┬───────┘
                 │
        ┌────────┴────────┐
        │                 │
       YES               NO
        │                 │
        ▼                 ▼
   ┌─────────┐    ┌─────────────────┐
   │  DONE   │    │ Analyze Failure │
   │ Report  │    └────────┬────────┘
   │ Success │             │
   └─────────┘             ▼
                  ┌─────────────────┐
                  │ Can I diagnose  │
                  │ root cause?     │
                  └────────┬────────┘
                           │
                  ┌────────┴────────┐
                  │                 │
                 YES               NO
                  │                 │
                  ▼                 ▼
           ┌───────────┐    ┌─────────────────┐
           │ Fix Code  │    │ Gather more     │
           │ Re-test   │    │ diagnostic info │
           └─────┬─────┘    └────────┬────────┘
                 │                   │
                 │                   ▼
                 │          ┌─────────────────┐
                 │          │ Still unclear?  │
                 │          └────────┬────────┘
                 │                   │
                 │          ┌────────┴────────┐
                 │          │                 │
                 │         YES               NO
                 │          │                 │
                 │          ▼                 │
                 │   ┌─────────────┐          │
                 │   │ ASK USER   │          │
                 │   │ Specific Q │          │
                 │   └─────────────┘          │
                 │                            │
                 └────────────────────────────┘
                           │
                        LOOP
```

### Iteration Limits

| Scenario | Max Attempts | Then Action |
|----------|--------------|-------------|
| Same error repeating | 3 | Ask user for guidance |
| Different errors each time | 5 | Stop, report all errors |
| Flaky test (intermittent) | 3 | Report as flaky, investigate |
| Total iterations | 10 | Stop, comprehensive report |

### Fix Strategies (Try In Order)

1. **Obvious fix** - Error message clearly indicates issue
2. **Related code inspection** - Look at surrounding code for context
3. **Console/network inspection** - Check browser devtools output
4. **Isolate** - Create minimal reproduction
5. **Compare working version** - Git diff against last known good
6. **Ask** - After exhausting above, ask specific question

---

## Question Escalation Protocol

### When to Ask

ASK when:
- Root cause unclear after 3 diagnostic attempts
- Need business logic clarification (not in codebase)
- External service/API behavior unexpected
- Requires access you don't have (credentials, services)
- Ambiguous requirements

DON'T ASK when:
- Error message tells you the problem
- You can find answer in codebase
- You haven't tried basic debugging
- It's a simple typo or syntax error

### Question Quality Standards

**Bad questions:**
- "It's not working, what should I do?"
- "I got an error"
- "The test failed"

**Good questions:**
- "Modal close handler isn't triggering. I verified the onClick is bound correctly and the event fires (console.log shows). The issue appears to be in the state update - setIsOpen(false) runs but component doesn't re-render. Is there a context provider I should be looking at?"
- "Supabase query returns empty but I confirmed the record exists via dashboard. RLS is the likely culprit - is there a policy on this table that filters by user_id? I'm testing with service key which should bypass RLS."
- "Test passes locally but fails in CI. The difference appears to be timing - the element isn't present when queried. Should I add explicit waits, or is there a loading state I should wait for?"

### Question Template

```markdown
## Issue
[One sentence: what's broken]

## What I Tried
1. [Diagnostic step 1] → [Result]
2. [Diagnostic step 2] → [Result]
3. [Diagnostic step 3] → [Result]

## Current Hypothesis
[Your best guess at root cause]

## Specific Question
[Exactly what you need to know to proceed]

## Relevant Code/Error
[Minimal snippet or error message]
```

---

## Common Test Patterns

### Pattern 1: Form Submission

```python
def test_form_submission(page, url, entity_path, form_data):
    """
    Test form submits and data persists.
    Generic for any entity: zones, sensors, orders, etc.
    """
    page.goto(f"{url}/{entity_path}/new")
    page.wait_for_load_state("networkidle")
    
    # Fill form dynamically
    for field_id, value in form_data.items():
        selector = f'[data-testid="{field_id}"]'
        element = page.locator(selector)
        tag = element.evaluate("el => el.tagName.toLowerCase()")
        
        if tag == "select":
            element.select_option(value)
        else:
            element.fill(str(value))
    
    # Submit
    page.click('[data-testid="submit-btn"]')
    
    # Wait for navigation or success state
    page.wait_for_url(f"{url}/{entity_path}/*")
    # OR
    page.wait_for_selector('[data-testid="success-toast"]')
    
    # Extract created ID for data verification
    new_url = page.url
    entity_id = new_url.split('/')[-1]
    
    return {"success": True, "created_id": entity_id}
```

### Pattern 2: Modal Interaction

```python
def test_modal_behavior(page, url):
    """Test modal opens, accepts input, closes."""
    page.goto(f"{url}/dashboard")
    page.wait_for_load_state("networkidle")
    
    # Open modal
    page.click('[data-testid="add-item-btn"]')
    
    # Verify modal appeared
    modal = page.wait_for_selector('[data-testid="item-modal"]', state="visible")
    assert modal is not None, "Modal did not open"
    
    # Interact
    page.fill('[data-testid="item-name"]', 'Test Item')
    page.click('[data-testid="modal-save"]')
    
    # Verify modal closed
    page.wait_for_selector('[data-testid="item-modal"]', state="hidden")
    
    return {"success": True}
```

### Pattern 3: Data Table Verification

```python
def test_data_table(page, url, table_path, expected_rows):
    """Verify table displays correct data."""
    page.goto(f"{url}/{table_path}")
    page.wait_for_load_state("networkidle")
    
    # Get all rows
    rows = page.locator('[data-testid="data-table"] tbody tr').all()
    
    if len(rows) != len(expected_rows):
        return {
            "success": False, 
            "error": f"Expected {len(expected_rows)} rows, got {len(rows)}"
        }
    
    # Verify content
    for i, expected in enumerate(expected_rows):
        cells = rows[i].locator('td').all_text_contents()
        for key, val in expected.items():
            if val not in cells:
                return {"success": False, "error": f"Row {i} missing expected value: {val}"}
    
    return {"success": True, "row_count": len(rows)}
```

### Pattern 4: Authentication Flow

```python
def test_with_auth(test_fn, credentials):
    """Wrapper that handles login before running test."""
    def wrapped(page, url):
        # Login
        page.goto(f"{url}/login")
        page.fill('[data-testid="email"]', credentials["email"])
        page.fill('[data-testid="password"]', credentials["password"])
        page.click('[data-testid="login-btn"]')
        
        # Wait for auth
        page.wait_for_url(f"{url}/dashboard")
        # OR wait for auth cookie/localStorage
        
        # Run actual test
        return test_fn(page, url)
    
    return wrapped
```

### Pattern 5: Network Request Verification

```python
def test_api_called_correctly(page, url):
    """Verify UI triggers correct API call."""
    api_calls = []
    
    def capture_request(request):
        if "/api/" in request.url:
            api_calls.append({
                "url": request.url,
                "method": request.method,
                "body": request.post_data
            })
    
    page.on("request", capture_request)
    
    page.goto(f"{url}/orders")
    page.click('[data-testid="refresh-btn"]')
    page.wait_for_load_state("networkidle")
    
    # Verify expected API call was made
    refresh_calls = [c for c in api_calls if "refresh" in c["url"]]
    assert len(refresh_calls) == 1, f"Expected 1 refresh call, got {len(refresh_calls)}"
    
    return {"success": True, "api_calls": api_calls}
```

---

## Diagnostic Tools

### Screenshot on Demand

```python
def screenshot(page, name="debug"):
    """Take screenshot for debugging."""
    path = f"/tmp/{name}-{int(time.time())}.png"
    page.screenshot(path=path, full_page=True)
    return path
```

### Console Log Capture

```python
def capture_console(page):
    """Capture all console output."""
    logs = []
    page.on("console", lambda msg: logs.append({
        "type": msg.type,
        "text": msg.text,
        "location": msg.location
    }))
    return logs
```

### Network Failure Detection

```python
def detect_failed_requests(page):
    """Capture failed network requests."""
    failures = []
    page.on("requestfailed", lambda req: failures.append({
        "url": req.url,
        "failure": req.failure
    }))
    return failures
```

### DOM State Dump

```python
def dump_dom_state(page, selector=None):
    """Get current DOM state for debugging."""
    if selector:
        element = page.locator(selector)
        return {
            "html": element.inner_html(),
            "text": element.text_content(),
            "visible": element.is_visible(),
            "attributes": element.evaluate("el => Object.fromEntries([...el.attributes].map(a => [a.name, a.value]))")
        }
    return page.content()
```

---

## Reporting Format

### Test Run Report

```markdown
## Test Run: [Feature/Component Name]
**Timestamp:** YYYY-MM-DD HH:MM:SS
**Environment:** local | staging | preview
**App URL:** http://localhost:3000

### Results Summary
| Test | Status | Duration |
|------|--------|----------|
| Form submission | ✅ PASS | 1.2s |
| Data persistence | ✅ PASS | 0.3s |
| Modal close | ❌ FAIL | 2.1s |

### Failures

#### Modal close
**Error:** Element not found: [data-testid="close-btn"]
**Screenshot:** /tmp/modal-fail-1234.png

**Diagnosis:**
- Button exists in DOM but has `display: none`
- CSS rule `.modal-header button { display: none }` overriding
- Introduced in commit abc123

**Fix Applied:** Removed conflicting CSS rule
**Re-test Result:** ✅ PASS

### Data Verification
| Table | Check | Result |
|-------|-------|--------|
| [entity_table] | New record created | ✅ |
| [entity_table] | Status = 'expected' | ✅ |
| audit_log | Entry created | ✅ |
```

### Iteration Report (Test-Fix-Repeat)

```markdown
## Iteration Log: [Feature Name]

### Iteration 1
- **Test Result:** ❌ FAIL - Modal not closing
- **Diagnosis:** onClick handler not bound
- **Fix:** Added onClick to close button
- **Confidence:** High

### Iteration 2
- **Test Result:** ❌ FAIL - Modal closes but state not reset
- **Diagnosis:** Form values persist after close
- **Fix:** Added resetForm() to onClose handler
- **Confidence:** High

### Iteration 3
- **Test Result:** ✅ PASS
- **All Tests Passing:** Yes
- **Total Iterations:** 3
- **Time Elapsed:** 4m 32s
```

---

## Integration with Agent System

### For Coding Agent

After making code changes, invoke testing:

```
1. Save code changes
2. Run relevant test suite
3. If FAIL:
   a. Analyze failure
   b. Attempt fix (max 3 for same error)
   c. Re-test
4. If PASS: Report success with evidence
5. If stuck: Escalate with specific question
```

### For Audit Agent

Verify claims made by coding agent:

```
1. Receive claim: "Modal now closes correctly"
2. Run modal close test
3. Verify both UI (modal hidden) and data (state reset)
4. Report: Claim VERIFIED or Claim DISPUTED + evidence
```

### Test Triggers

| Code Change | Tests to Run |
|-------------|--------------|
| Component modified | Component-specific + integration |
| API route changed | API + dependent UI tests |
| Database schema | Data verification + affected features |
| Style/CSS | Visual regression (screenshot compare) |
| State management | State persistence + derived UI |

---

## Error Handling

| Issue | Action |
|-------|--------|
| App not running | Check if dev server started, provide command |
| Auth required | Use test credentials from 1Password/env |
| Timeout waiting | Increase timeout, check for async issues |
| Element not found | Verify selector, check if dynamic/lazy loaded |
| Supabase connection failed | Verify env vars, check service key |
| Flaky test | Run 3x, if 2/3 pass mark as flaky for investigation |

---

## Environment Detection

```python
import os

def get_test_environment():
    """Determine which environment to test against."""
    # Priority: explicit env var > running local server > staging
    if os.getenv("TEST_URL"):
        return os.getenv("TEST_URL")
    
    # Check if local dev server running
    try:
        import requests
        local = os.getenv("LOCAL_APP_URL", "http://localhost:3000")
        resp = requests.get(local, timeout=2)
        if resp.status_code == 200:
            return local
    except:
        pass
    
    # Fall back to staging
    return os.getenv("STAGING_APP_URL")
```

---

## Quick Start

### Minimal Test

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    page.goto("http://localhost:3000")
    
    # Your test here
    assert page.title() is not None
    print(f"✅ App loaded: {page.title()}")
    
    browser.close()
```

### With Data Verification

```python
# After UI test...
from supabase import create_client

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
result = sb.table("your_table").select("*").eq("id", created_id).single().execute()

assert result.data["status"] == "expected_status", f"Expected expected_status, got {result.data['status']}"
print("✅ Data verified")
```