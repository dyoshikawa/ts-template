import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ja } from "../i18n/ja";
import { Turnstile } from "./turnstile";

afterEach(() => {
  cleanup();
  delete window.turnstile;
});

describe("Turnstile", () => {
  it("hands out a placeholder token and renders nothing when disabled", async () => {
    const onToken = vi.fn();
    const { container } = render(
      <Turnstile config={{ status: "disabled" }} action="sign-in" onToken={onToken} />,
    );
    await act(async () => {});
    expect(container.innerHTML).toBe("");
    expect(onToken).toHaveBeenCalledWith("turnstile-disabled");
    expect(document.querySelector("script[src*='challenges.cloudflare.com']")).toBeNull();
  });

  it("hands out no token and says so when the server has no key pair", async () => {
    const onToken = vi.fn();
    const { getByRole } = render(
      <Turnstile config={{ status: "unconfigured" }} action="sign-in" onToken={onToken} />,
    );
    await act(async () => {});
    // Outside a provider the text is Japanese, the default language.
    expect(getByRole("alert").textContent).toBe(ja.turnstile.unavailable);
    expect(onToken).toHaveBeenCalledWith(null);
    expect(onToken).not.toHaveBeenCalledWith(expect.any(String));
    expect(document.querySelector("script[src*='challenges.cloudflare.com']")).toBeNull();
  });

  it("renders the widget with the site key and action and relays its callbacks", async () => {
    const remove = vi.fn();
    let options: {
      sitekey: string;
      action: string;
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
    const { unmount } = render(
      <Turnstile
        config={{ status: "enabled", siteKey: "0xSITE" }}
        action="delete-account"
        onToken={onToken}
      />,
    );
    await act(async () => {});
    expect(options).not.toBeNull();
    expect(options!.sitekey).toBe("0xSITE");
    expect(options!.action).toBe("delete-account");
    act(() => {
      options!.callback("tok");
      options!["expired-callback"]();
    });
    expect(onToken.mock.calls).toEqual([["tok"], [null]]);
    unmount();
    expect(remove).toHaveBeenCalledWith("widget-1");
  });
});
