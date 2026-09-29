import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Turnstile } from "./turnstile";

afterEach(() => {
  cleanup();
  delete window.turnstile;
});

describe("Turnstile", () => {
  it("hands out a placeholder token and renders nothing when disabled", async () => {
    const onToken = vi.fn();
    const { container } = render(<Turnstile siteKey="" onToken={onToken} />);
    await act(async () => {});
    expect(container.innerHTML).toBe("");
    expect(onToken).toHaveBeenCalledWith("turnstile-disabled");
    expect(document.querySelector("script[src*='challenges.cloudflare.com']")).toBeNull();
  });

  it("renders the widget with the site key and relays its callbacks", async () => {
    const remove = vi.fn();
    let options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
    } | null = null;
    window.turnstile = {
      render: (_container, rendered) => {
        options = rendered;
        return "widget-1";
      },
      remove,
    };
    const onToken = vi.fn();
    const { unmount } = render(<Turnstile siteKey="0xSITE" onToken={onToken} />);
    await act(async () => {});
    expect(options).not.toBeNull();
    expect(options!.sitekey).toBe("0xSITE");
    act(() => {
      options!.callback("tok");
      options!["expired-callback"]();
    });
    expect(onToken.mock.calls).toEqual([["tok"], [null]]);
    unmount();
    expect(remove).toHaveBeenCalledWith("widget-1");
  });
});
