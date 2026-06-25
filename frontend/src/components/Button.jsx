"use client";

import React, { useState, useEffect, forwardRef } from 'react';

// Class merger utility (simple vanilla alternative to clsx/cn)
const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * Metal Button component with metallic gradients and press/hover effects
 */
const MetalButton = forwardRef(({ children, className, variant = 'default', ...props }, ref) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const buttonText = children || 'Button';

  // Apply manual inline transformations for press & hover to mimic the variants JS logic
  const wrapperStyle = {
    transform: isPressed ? 'translateY(2.5px) scale(0.99)' : 'translateY(0) scale(1)',
    boxShadow: isPressed
      ? '0 1px 2px rgba(0, 0, 0, 0.15)'
      : isHovered && !isTouchDevice
        ? '0 4px 12px rgba(0, 0, 0, 0.18)'
        : '0 3px 8px rgba(0, 0, 0, 0.12)',
    transition: 'all 250ms cubic-bezier(0.1, 0.4, 0.2, 1)',
    transformOrigin: 'center center',
  };

  const innerStyle = {
    transition: 'all 250ms cubic-bezier(0.1, 0.4, 0.2, 1)',
    transformOrigin: 'center center',
    filter: isHovered && !isPressed && !isTouchDevice ? 'brightness(1.08)' : 'none',
  };

  const buttonStyle = {
    transform: isPressed ? 'scale(0.97)' : 'scale(1)',
    transition: 'all 250ms cubic-bezier(0.1, 0.4, 0.2, 1)',
    transformOrigin: 'center center',
    filter: isHovered && !isPressed && !isTouchDevice ? 'brightness(1.05)' : 'none',
  };

  return (
    <div 
      className={cn('metal-btn-wrapper', `variant-${variant}`, className)} 
      style={wrapperStyle}
    >
      <div 
        className={cn('metal-btn-inner', `variant-${variant}`)} 
        style={innerStyle}
      ></div>
      <button
        ref={ref}
        className={cn('metal-btn', `variant-${variant}`)}
        style={buttonStyle}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => { setIsPressed(false); setIsHovered(false); }}
        onMouseEnter={() => { if (!isTouchDevice) setIsHovered(true); }}
        onTouchStart={() => setIsPressed(true)}
        onTouchEnd={() => setIsPressed(false)}
        onTouchCancel={() => setIsPressed(false)}
        {...props}
      >
        {/* Shine effect */}
        <div className={cn('metal-btn-shine', isPressed ? 'pressed' : '')}>
          <div className="shine-bar" />
        </div>
        
        {buttonText}

        {isHovered && !isPressed && !isTouchDevice && (
          <div className="metal-btn-overlay" />
        )}
      </button>
    </div>
  );
});
MetalButton.displayName = 'MetalButton';


/**
 * Liquid Button component with turbulent glass filter
 */
function GlassFilter() {
  return (
    <svg className="hidden-svg-filter">
      <defs>
        <filter
          id="container-glass"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05 0.05"
            numOctaves="1"
            seed="1"
            result="turbulence"
          />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            scale="70"
            xChannelSelector="R"
            yChannelSelector="B"
            result="displaced"
          />
          <feGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

const LiquidButton = forwardRef(({ children, className, size = 'default', ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn('liquid-btn-wrapper', `size-${size}`, className)}
      {...props}
    >
      <div className="liquid-btn-glass" />
      <div
        className="liquid-btn-backdrop"
        style={{ backdropFilter: 'url("#container-glass")' }}
      />
      <div className="liquid-btn-content">
        {children}
      </div>
      <GlassFilter />
    </button>
  );
});
LiquidButton.displayName = 'LiquidButton';


/**
 * Default standard cartoon button (already styled in index.css)
 */
const Button = forwardRef(({ children, className, variant = 'default', ...props }, ref) => {
  const variantClass = variant === 'primary' 
    ? 'cartoon-button-primary' 
    : variant === 'accent' 
      ? 'cartoon-button-accent' 
      : 'cartoon-button-outline';
      
  return (
    <button
      ref={ref}
      className={cn('cartoon-button', variantClass, className)}
      {...props}
    >
      {children}
    </button>
  );
});
Button.displayName = 'Button';

export { Button, LiquidButton, MetalButton };
