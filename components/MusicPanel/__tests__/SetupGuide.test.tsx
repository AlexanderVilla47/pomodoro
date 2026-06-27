import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SetupGuide } from "../SetupGuide";

describe("SetupGuide", () => {
  it("se renderiza cuando configured=false", () => {
    render(<SetupGuide />);
    expect(screen.getAllByText(/YOUTUBE_API_KEY/i).length).toBeGreaterThan(0);
  });

  it("muestra instrucciones de configuración con referencia a .env.local", () => {
    const { container } = render(<SetupGuide />);
    expect(container.textContent).toContain(".env.local");
  });

  it("muestra un bloque pre>code con la variable de entorno", () => {
    const { container } = render(<SetupGuide />);
    const code = container.querySelector("pre code");
    expect(code).not.toBeNull();
    expect(code!.textContent).toContain("YOUTUBE_API_KEY");
  });
});
