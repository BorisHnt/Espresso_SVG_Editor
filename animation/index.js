export function setupAnimationTools({ eventBus }) {
  eventBus.on("animation:pulse-selected", ({ element }) => {
    if (!element) {
      return;
    }
    const animate = document.createElementNS("http://www.w3.org/2000/svg", "animate");
    animate.setAttribute("attributeName", "opacity");
    animate.setAttribute("values", "1;0.4;1");
    animate.setAttribute("dur", "1.2s");
    animate.setAttribute("repeatCount", "indefinite");
    element.append(animate);
  });
}
