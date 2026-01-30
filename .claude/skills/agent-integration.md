# Agent Integration Guide

How your Claude Code agents use live app testing for autonomous verification.

## Agent Workflow Integration

### Coding Agent → Test → Fix Loop

```
┌─────────────────────────────────────────────────────────────┐
│                     CODING AGENT                            │
├─────────────────────────────────────────────────────────────┤
│  1. Receive task: "Fix modal not closing on save"          │
│  2. Analyze code, identify likely cause                     │
│  3. Implement fix                                           │
│  4. ─────────────────────────────────────────────────────── │
│     │  INVOKE: Live App Tester                              │
│     │  ┌─────────────────────────────────────────────────┐  │
│     │  │  • Launch browser                               │  │
│     │  │  • Navigate to feature                          │  │
│     │  │  • Trigger modal open                           │  │
│     │  │  • Fill form, click save                        │  │
│     │  │  • Assert: modal hidden + data persisted        │  │
│     │  └─────────────────────────────────────────────────┘  │
│  5. ─────────────────────────────────────────────────────── │
│     │                                                       │
│     ├── PASS → Report success with evidence                 │
│     │                                                       │
│     └── FAIL → Analyze error                                │
│              │                                              │
│              ├── Can diagnose → Apply fix → GOTO step 4     │
│              │                                              │
│              └── Cannot diagnose → Escalate with question   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Audit Agent → Verification

```
┌─────────────────────────────────────────────────────────────┐
│                     AUDIT AGENT                             │
├─────────────────────────────────────────────────────────────┤
│  INPUT: Coding agent claims "Modal now closes correctly"    │
│                                                             │
│  1. Parse claim → Extract testable assertions:              │
│     • Modal closes (UI state)                               │
│     • Data saves correctly (DB state)                       │
│     • No console errors (runtime health)                    │
│                                                             │
│  2. Run verification tests:                                 │
│     ┌─────────────────────────────────────────────────────┐ │
│     │  TEST 1: UI State                                   │ │
│     │  • Open modal → fill form → click save              │ │
│     │  • Assert: modal element has display:none           │ │
│     │  • Result: ✅ PASS                                  │ │
│     ├─────────────────────────────────────────────────────┤ │
│     │  TEST 2: Data Persistence                           │ │
│     │  • Query Supabase for new record                    │ │
│     │  • Assert: record exists with correct values        │ │
│     │  • Result: ✅ PASS                                  │ │
│     ├─────────────────────────────────────────────────────┤ │
│     │  TEST 3: Runtime Health                             │ │
│     │  • Capture console during flow                      │ │
│     │  • Assert: no error-level messages                  │ │
│     │  • Result: ⚠️ WARNING - deprecation notice          │ │
│     └─────────────────────────────────────────────────────┘ │
│                                                             │
│  3. OUTPUT: Verification Report                             │
│     • Claim: VERIFIED (with caveats)                        │
│     • Evidence: Screenshots, data snapshots                 │
│     • Notes: Non-blocking deprecation warning found         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementing in Claude Code

### Coding Agent Test Block

When coding agent completes a change, add this to CLAUDE.md or invoke directly:

```markdown
## Post-Change Verification Protocol

After implementing code changes, ALWAYS verify by:

1. **Identify affected feature** - What UI flow does this change impact?

2. **Write/run test** - Use live-app-tester skill:
   ```python
   from test_runner import LiveAppTester
   
   tester = LiveAppTester(app_url="http://localhost:3000")
   
   def test_my_change(page, url):
       # Navigate to affected area
       page.goto(f"{url}/path/to/feature")
       
       # Perform the action your change affects
       page.click('[data-testid="trigger-btn"]')
       
       # Assert expected behavior
       result = page.wait_for_selector('[expected-element]')
       return {"success": result is not None}
   
   result = tester.run_test(test_my_change, "my_change_test")
   ```

3. **If test fails:**
   - Analyze error + console + screenshot
   - Attempt fix (max 3 times for same error)
   - Re-run test

4. **If test passes:**
   - Report: "✅ Verified: [description of what was tested]"
   - Include evidence: screenshot path or key assertions

5. **If stuck:**
   - Use escalation template from skill
   - Ask specific question with diagnostic context
```

### Audit Agent Verification Block

```markdown
## Claim Verification Protocol

When verifying claims from coding agent:

1. **Parse claim into assertions**
   - "Modal closes" → UI: modal.isVisible() === false
   - "Data saves" → DB: record exists with expected values
   - "No errors" → Console: no error-type logs

2. **Run independent tests** (don't trust coding agent's tests)
   ```python
   def verify_claim(page, url):
       # Replicate the user flow independently
       page.goto(f"{url}/feature")
       
       # Trigger the claimed behavior
       page.click('[data-testid="action"]')
       
       # Verify EACH assertion
       assertions = {
           "ui_state": verify_ui_state(page),
           "data_state": verify_data_state(),
           "runtime_health": verify_no_errors()
       }
       
       return {
           "success": all(a["passed"] for a in assertions.values()),
           "assertions": assertions
       }
   ```

3. **Report findings**
   - VERIFIED: All assertions pass
   - DISPUTED: One or more assertions fail
   - PARTIAL: Some pass, some fail with explanation
```

---

## Question Escalation Examples

### Good Questions (Agent should ask these)

**Blocked by external dependency:**
```markdown
## Issue
Test passes locally but API call returns 401 in test environment.

## What I Tried
1. Verified auth token is present in request headers ✓
2. Confirmed token format matches expected pattern ✓
3. Tested same endpoint via curl with same token → Works ✓

## Hypothesis
Something in the test browser context isn't sending cookies/headers correctly.

## Question
Is there a specific auth setup needed for Playwright tests? Should I be using a service account or test user credentials?
```

**Ambiguous requirements:**
```markdown
## Issue
Modal close behavior unclear - should clicking outside close it?

## What I Tried
1. Implemented close on backdrop click
2. Test passes, but noticed existing modals DON'T close on backdrop click
3. Checked design system docs - no guidance

## Question
What's the intended behavior for modal dismissal in this app? 
- Close on: X button only? Escape key? Backdrop click?
- Should there be unsaved changes warning?
```

### Bad Questions (Agent should NOT ask these)

❌ "The test is failing, what should I do?"
→ Agent should diagnose first

❌ "Is this the right approach?"
→ Test it and find out

❌ "I got an error"
→ Include the error, what you tried, and what you need

---

## Project Configuration

Create a `test_config.py` in each project to define app-specific settings:

```python
# test_config.py - Project-specific test configuration

TEST_CONFIG = {
    "app_name": "EnviroFlow",  # or "MuRP", etc.
    
    # Environment URLs
    "urls": {
        "local": "http://localhost:3000",
        "staging": "https://staging.enviroflow.app",
        "preview": "https://enviroflow-preview.vercel.app"
    },
    
    # Database
    "supabase": {
        "url_env": "SUPABASE_URL",
        "key_env": "SUPABASE_SERVICE_KEY"
    },
    
    # Auth (if needed)
    "auth": {
        "method": "supabase",  # or "credentials", "oauth", "none"
        "test_user_env": "TEST_USER_EMAIL",
        "test_pass_env": "TEST_USER_PASSWORD",
        # OR for 1Password
        "onepass_item": "enviroflow-test"
    },
    
    # Common selectors for this app
    "selectors": {
        "login_email": '[data-testid="email-input"]',
        "login_password": '[data-testid="password-input"]',
        "login_submit": '[data-testid="login-btn"]',
        "success_toast": '[data-testid="toast-success"]',
        "error_toast": '[data-testid="toast-error"]',
        "loading_spinner": '[data-testid="loading"]',
        "modal_backdrop": '[data-testid="modal-backdrop"]'
    },
    
    # Wait strategies
    "waits": {
        "page_load": "networkidle",
        "default_timeout": 5000,
        "slow_timeout": 15000
    }
}
```

### Loading Config in Tests

```python
from test_config import TEST_CONFIG

def test_with_config(page, url):
    selectors = TEST_CONFIG["selectors"]
    
    page.goto(url)
    page.wait_for_load_state(TEST_CONFIG["waits"]["page_load"])
    
    # Use project-specific selectors
    page.click(selectors["some_button"])
    page.wait_for_selector(selectors["success_toast"])
```

---

## Generic Test Patterns

### Pattern: CRUD Operations

```python
def test_create_entity(page, url, entity_type, form_data):
    """
    Generic create flow - works for any entity type.
    
    Args:
        entity_type: "zone", "sensor", "purchase-order", etc.
        form_data: Dict of {field_testid: value}
    """
    page.goto(f"{url}/{entity_type}/new")
    page.wait_for_load_state("networkidle")
    
    # Fill form dynamically
    for field_id, value in form_data.items():
        selector = f'[data-testid="{field_id}"]'
        element = page.locator(selector)
        
        # Handle different input types
        tag = element.evaluate("el => el.tagName.toLowerCase()")
        if tag == "select":
            element.select_option(value)
        elif tag == "input" and element.get_attribute("type") == "checkbox":
            if value:
                element.check()
        else:
            element.fill(str(value))
    
    # Submit
    page.click('[data-testid="submit-btn"]')
    
    # Wait for success indicator
    page.wait_for_selector('[data-testid="success-toast"]', timeout=5000)
    
    # Extract created ID from URL or response
    new_url = page.url
    entity_id = new_url.split('/')[-1] if '/' in new_url else None
    
    return {"success": True, "entity_id": entity_id, "entity_type": entity_type}


def test_read_entity(page, url, entity_type, entity_id, expected_fields):
    """Verify entity displays correct data."""
    page.goto(f"{url}/{entity_type}/{entity_id}")
    page.wait_for_load_state("networkidle")
    
    mismatches = {}
    for field_id, expected_value in expected_fields.items():
        selector = f'[data-testid="{field_id}"]'
        actual = page.locator(selector).text_content()
        
        if str(expected_value) not in actual:
            mismatches[field_id] = {"expected": expected_value, "actual": actual}
    
    return {
        "success": len(mismatches) == 0,
        "mismatches": mismatches if mismatches else None
    }


def test_update_entity(page, url, entity_type, entity_id, updates):
    """Update entity and verify changes persisted."""
    page.goto(f"{url}/{entity_type}/{entity_id}/edit")
    page.wait_for_load_state("networkidle")
    
    # Apply updates
    for field_id, new_value in updates.items():
        selector = f'[data-testid="{field_id}"]'
        page.locator(selector).fill("")  # Clear first
        page.locator(selector).fill(str(new_value))
    
    page.click('[data-testid="save-btn"]')
    page.wait_for_selector('[data-testid="success-toast"]')
    
    # Verify by re-reading
    return test_read_entity(page, url, entity_type, entity_id, updates)


def test_delete_entity(page, url, entity_type, entity_id):
    """Delete entity and verify removal."""
    page.goto(f"{url}/{entity_type}/{entity_id}")
    page.wait_for_load_state("networkidle")
    
    page.click('[data-testid="delete-btn"]')
    
    # Handle confirmation modal
    page.click('[data-testid="confirm-delete"]')
    
    # Should redirect to list
    page.wait_for_url(f"{url}/{entity_type}")
    
    # Verify entity no longer in list
    entity_row = page.locator(f'[data-testid="row-{entity_id}"]')
    
    return {"success": entity_row.count() == 0}
```

### Pattern: Real-time Data (IoT/Sensors)

```python
def test_realtime_data_updates(page, url, data_source, timeout=10000):
    """
    Verify UI updates when new data arrives.
    Works for sensor readings, live metrics, etc.
    
    Args:
        data_source: Identifier for what's updating (sensor_id, zone_id, etc.)
        timeout: How long to wait for an update
    """
    page.goto(f"{url}/dashboard")
    page.wait_for_load_state("networkidle")
    
    # Capture initial value
    value_selector = f'[data-testid="live-value-{data_source}"]'
    initial_value = page.locator(value_selector).text_content()
    initial_time = page.locator(f'[data-testid="last-updated-{data_source}"]').text_content()
    
    # Wait for value to change (or timeout)
    try:
        page.wait_for_function(
            f"""() => {{
                const el = document.querySelector('[data-testid="live-value-{data_source}"]');
                return el && el.textContent !== '{initial_value}';
            }}""",
            timeout=timeout
        )
        
        new_value = page.locator(value_selector).text_content()
        return {
            "success": True,
            "initial": initial_value,
            "updated": new_value,
            "data_source": data_source
        }
    except:
        return {
            "success": False,
            "error": f"No update received within {timeout}ms",
            "initial": initial_value,
            "data_source": data_source
        }


def test_historical_data_chart(page, url, entity_id, time_range="24h"):
    """Verify chart loads and displays data points."""
    page.goto(f"{url}/analytics/{entity_id}?range={time_range}")
    page.wait_for_load_state("networkidle")
    
    # Wait for chart to render
    chart = page.wait_for_selector('[data-testid="data-chart"]', timeout=5000)
    
    # Check for data points (SVG paths, canvas, etc.)
    data_points = page.locator('[data-testid="data-chart"] path, [data-testid="data-chart"] circle').count()
    
    return {
        "success": data_points > 0,
        "data_points": data_points,
        "time_range": time_range
    }
```

### Pattern: State Transitions

```python
def test_state_transition(page, url, entity_type, entity_id, action, expected_state):
    """
    Test state machine transitions.
    Works for: order status, growth phases, device states, etc.
    
    Args:
        action: Button/trigger to click (e.g., "approve-btn", "advance-phase")
        expected_state: What state should be after action
    """
    page.goto(f"{url}/{entity_type}/{entity_id}")
    page.wait_for_load_state("networkidle")
    
    # Capture current state
    state_badge = page.locator('[data-testid="status-badge"]')
    initial_state = state_badge.text_content()
    
    # Trigger transition
    page.click(f'[data-testid="{action}"]')
    
    # Handle confirmation if present
    confirm_btn = page.locator('[data-testid="confirm-action"]')
    if confirm_btn.is_visible():
        confirm_btn.click()
    
    # Wait for state change
    page.wait_for_function(
        f"""() => {{
            const badge = document.querySelector('[data-testid="status-badge"]');
            return badge && badge.textContent.includes('{expected_state}');
        }}""",
        timeout=5000
    )
    
    new_state = page.locator('[data-testid="status-badge"]').text_content()
    
    return {
        "success": expected_state in new_state,
        "initial_state": initial_state,
        "expected_state": expected_state,
        "actual_state": new_state
    }
```

### Pattern: Form Validation

```python
def test_form_validation(page, url, form_path, invalid_inputs, expected_errors):
    """
    Test form shows correct validation errors.
    
    Args:
        invalid_inputs: Dict of {field_testid: invalid_value}
        expected_errors: Dict of {field_testid: expected_error_message}
    """
    page.goto(f"{url}/{form_path}")
    page.wait_for_load_state("networkidle")
    
    # Fill with invalid data
    for field_id, value in invalid_inputs.items():
        page.locator(f'[data-testid="{field_id}"]').fill(str(value))
    
    # Trigger validation (submit or blur)
    page.click('[data-testid="submit-btn"]')
    
    # Check for expected errors
    found_errors = {}
    missing_errors = []
    
    for field_id, expected_msg in expected_errors.items():
        error_selector = f'[data-testid="{field_id}-error"]'
        error_el = page.locator(error_selector)
        
        if error_el.is_visible():
            actual_msg = error_el.text_content()
            found_errors[field_id] = actual_msg
            if expected_msg not in actual_msg:
                missing_errors.append({
                    "field": field_id,
                    "expected": expected_msg,
                    "actual": actual_msg
                })
        else:
            missing_errors.append({
                "field": field_id,
                "expected": expected_msg,
                "actual": "No error shown"
            })
    
    return {
        "success": len(missing_errors) == 0,
        "found_errors": found_errors,
        "missing_errors": missing_errors if missing_errors else None
    }
```

### Pattern: Data Table with Filters

```python
def test_table_filtering(page, url, table_path, filters, expected_count=None):
    """
    Test table filtering works correctly.
    
    Args:
        filters: Dict of {filter_testid: value}
        expected_count: Expected row count (None to just verify filter applied)
    """
    page.goto(f"{url}/{table_path}")
    page.wait_for_load_state("networkidle")
    
    # Get initial count
    initial_rows = page.locator('tbody tr').count()
    
    # Apply filters
    for filter_id, value in filters.items():
        filter_el = page.locator(f'[data-testid="{filter_id}"]')
        tag = filter_el.evaluate("el => el.tagName.toLowerCase()")
        
        if tag == "select":
            filter_el.select_option(value)
        else:
            filter_el.fill(value)
            filter_el.press("Enter")  # Trigger filter
    
    # Wait for table to update
    page.wait_for_load_state("networkidle")
    
    filtered_rows = page.locator('tbody tr').count()
    
    result = {
        "success": True,
        "initial_count": initial_rows,
        "filtered_count": filtered_rows,
        "filters_applied": filters
    }
    
    if expected_count is not None:
        result["success"] = filtered_rows == expected_count
        result["expected_count"] = expected_count
    
    return result
```

---

## Environment Setup Checklist

```bash
# 1. Install dependencies
pip install playwright supabase --break-system-packages
playwright install chromium

# 2. Set environment variables (or use 1Password)
export LOCAL_APP_URL="http://localhost:3000"
export SUPABASE_URL="https://xxxxx.supabase.co"
export SUPABASE_SERVICE_KEY="eyJ..."

# 3. Verify local app is running
curl -I http://localhost:3000  # Should return 200

# 4. Test Supabase connection
python -c "from supabase import create_client; import os; print(create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY')).table('your_table').select('id').limit(1).execute())"

# 5. Run a quick test
python -c "
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:3000')
    print(f'Title: {page.title()}')
    browser.close()
"
```

---

## Failure Recovery Strategies

| Failure Type | Recovery Strategy |
|--------------|-------------------|
| Element not found | 1. Screenshot current state 2. Check if element is lazy-loaded 3. Add explicit wait 4. Verify selector accuracy |
| Timeout | 1. Increase timeout 2. Check for blocking modals/overlays 3. Verify network completed 4. Check for JS errors |
| Data mismatch | 1. Verify test isolation (no shared state) 2. Check for async updates 3. Add delay before verification 4. Verify correct environment |
| Auth failure | 1. Refresh/recreate auth tokens 2. Verify test user exists 3. Check session expiry 4. Verify correct credentials |
| Flaky test | 1. Add explicit waits 2. Verify no race conditions 3. Run 3x to confirm 4. Add retry logic |