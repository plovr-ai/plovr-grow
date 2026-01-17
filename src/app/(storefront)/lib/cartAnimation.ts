/**
 * Cart animation utility - fly to cart animation
 */

export interface AnimationPosition {
  x: number;
  y: number;
}

export interface FlyToCartParams {
  startPosition: AnimationPosition;
  imageUrl: string | null;
}

/**
 * Get the cart icon target position
 */
function getCartTargetPosition(): AnimationPosition {
  const cartIcon = document.getElementById("cart-icon-target");
  if (cartIcon) {
    const cartRect = cartIcon.getBoundingClientRect();
    return {
      x: cartRect.left + cartRect.width / 2 - 20,
      y: cartRect.top + cartRect.height / 2 - 20,
    };
  }
  // Fallback: fly to bottom center of screen
  return {
    x: window.innerWidth / 2 - 20,
    y: window.innerHeight - 60,
  };
}

/**
 * Animate an element flying from start position to cart icon
 */
export function animateFlyToCart(params: FlyToCartParams): void {
  const { startPosition, imageUrl } = params;
  const endPosition = getCartTargetPosition();

  const el = document.createElement("div");
  el.style.cssText = `
    position: fixed;
    left: 0;
    top: 0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    z-index: 9999;
    pointer-events: none;
    background: ${imageUrl ? `url(${imageUrl}) center/cover` : "#ef4444"};
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    will-change: transform, opacity;
  `;
  document.body.appendChild(el);

  const duration = 500;
  const startTime = performance.now();

  // Parabola parameters
  const deltaX = endPosition.x - startPosition.x;
  const deltaY = endPosition.y - startPosition.y;
  const peakHeight = Math.min(150, Math.abs(deltaY) * 0.4 + 50);

  function easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }

  function animate(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // X moves linearly (or with slight ease)
    const easedProgress = easeOutQuad(progress);
    const x = startPosition.x + deltaX * easedProgress;

    // Y follows parabola: starts up, then curves down
    // Using quadratic bezier-like path
    const t = easedProgress;
    const y = startPosition.y + deltaY * t + peakHeight * 4 * t * (t - 1);

    // Scale shrinks from 1 to 0.3
    const scale = 1 - 0.7 * easedProgress;

    // Opacity stays 1 until near end
    const opacity = progress > 0.8 ? 1 - (progress - 0.8) * 2.5 : 1;

    el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    el.style.opacity = String(opacity);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      el.remove();
    }
  }

  requestAnimationFrame(animate);
}

/**
 * Calculate animation start position from a DOM element
 */
export function getElementCenterPosition(element: HTMLElement): AnimationPosition {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - 20,
    y: rect.top + rect.height / 2 - 20,
  };
}
