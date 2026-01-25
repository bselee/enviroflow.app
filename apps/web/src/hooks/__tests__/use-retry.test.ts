/**
 * Tests for useRetry hook
 *
 * These tests verify that the retry logic works correctly with different scenarios:
 * - Successful operation on first attempt
 * - Success after retries
 * - Failure after max retries
 * - Exponential backoff timing
 * - Error classification
 */

import { renderHook, act } from "@testing-library/react";
import { useRetry } from "../use-retry";

// Mock timers for testing delays
jest.useFakeTimers();

describe("useRetry", () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  it("should succeed on first attempt", async () => {
    const mockFn = jest.fn().mockResolvedValue("success");
    const { result } = renderHook(() => useRetry(mockFn, { maxAttempts: 3 }));

    await act(async () => {
      const promise = result.current.execute();
      await promise;
    });

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("success");
    expect(result.current.attempt).toBe(1);
    expect(result.current.data).toBe("success");
  });

  it("should retry on failure and succeed", async () => {
    const mockFn = jest
      .fn()
      .mockRejectedValueOnce(new Error("First attempt failed"))
      .mockResolvedValueOnce("success");

    const { result } = renderHook(() =>
      useRetry(mockFn, {
        maxAttempts: 3,
        baseDelay: 1000,
      })
    );

    let executePromise: Promise<string>;

    act(() => {
      executePromise = result.current.execute();
    });

    // Fast-forward through first retry delay (2s exponential)
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await act(async () => {
      await executePromise;
    });

    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("success");
  });

  it("should fail after max retries", async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error("Always fails"));

    const { result } = renderHook(() =>
      useRetry(mockFn, {
        maxAttempts: 3,
        baseDelay: 1000,
      })
    );

    let executePromise: Promise<string>;
    let caughtError: Error | null = null;

    act(() => {
      executePromise = result.current.execute().catch((err) => {
        caughtError = err;
      });
    });

    // Fast-forward through all retries
    await act(async () => {
      jest.advanceTimersByTime(2000); // First retry
      jest.advanceTimersByTime(4000); // Second retry
    });

    await act(async () => {
      await executePromise;
    });

    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe("failed");
    expect(result.current.error).toBeTruthy();
    expect(caughtError).toBeTruthy();
  });

  it("should classify network errors correctly", async () => {
    const networkError = new Error("fetch failed");
    const mockFn = jest.fn().mockRejectedValue(networkError);

    const { result } = renderHook(() =>
      useRetry(mockFn, {
        maxAttempts: 1,
      })
    );

    await act(async () => {
      try {
        await result.current.execute();
      } catch {
        // Expected to fail
      }
    });

    expect(result.current.error?.type).toBe("network");
  });

  it("should classify credential errors correctly", async () => {
    const credError = new Error("Invalid password");
    const mockFn = jest.fn().mockRejectedValue(credError);

    const { result } = renderHook(() =>
      useRetry(mockFn, {
        maxAttempts: 1,
      })
    );

    await act(async () => {
      try {
        await result.current.execute();
      } catch {
        // Expected to fail
      }
    });

    expect(result.current.error?.type).toBe("credentials");
  });

  it("should call onAttempt callback", async () => {
    const mockFn = jest.fn().mockResolvedValue("success");
    const onAttempt = jest.fn();

    const { result } = renderHook(() =>
      useRetry(mockFn, {
        maxAttempts: 3,
        onAttempt,
      })
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(onAttempt).toHaveBeenCalledWith(1, 3);
  });

  it("should reset state correctly", async () => {
    const mockFn = jest.fn().mockResolvedValue("success");

    const { result } = renderHook(() => useRetry(mockFn, { maxAttempts: 3 }));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.status).toBe("success");

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.attempt).toBe(0);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it("should handle exponential backoff correctly", async () => {
    const mockFn = jest
      .fn()
      .mockRejectedValueOnce(new Error("Fail 1"))
      .mockRejectedValueOnce(new Error("Fail 2"))
      .mockResolvedValueOnce("success");

    const { result } = renderHook(() =>
      useRetry(mockFn, {
        maxAttempts: 3,
        baseDelay: 1000,
        backoff: "exponential",
      })
    );

    let executePromise: Promise<string>;

    act(() => {
      executePromise = result.current.execute();
    });

    // First retry should wait 2s (1000 * 2^0)
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    // Second retry should wait 4s (1000 * 2^1)
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });

    await act(async () => {
      await executePromise;
    });

    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe("success");
  });
});
