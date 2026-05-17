import React from "react";
import type { JSX } from "react";

type IconProps = {
	/** SVG element to render (an <svg> element) */
	icon?: JSX.Element;
	/** path to an SVG file to render (used if `icon` not provided) */
	src?: string;
	/** additional className to apply to the svg or img */
	className?: string;
};

export default function Instagram({ icon, src, className }: IconProps): JSX.Element {
	// If an `icon` JSX is provided, clone it and force `fill` to currentColor
	// then wrap with a white `color` so `currentColor` renders white.
	if (icon) {
		const cloned = React.cloneElement(icon, {
			fill: "currentColor",
			stroke: (icon.props && icon.props.stroke) || undefined,
			className: [icon.props?.className, className, "icon-sm"].filter(Boolean).join(" "),
			"aria-hidden": true,
		});

		return (
			<span style={{ color: "#fff", display: "inline-block" }} aria-hidden>
				{cloned}
			</span>
		);
	}

	// If a `src` path is provided, render an <img> and apply a CSS filter
	// to make the icon appear white. This works for monochrome SVGs.
	if (typeof src === "string") {
		return (
			<img
				src={src}
				alt="Instagram"
				className={["icon-sm", className].filter(Boolean).join(" ")}
				style={{ filter: "brightness(0) invert(1)", display: "inline-block" }}
				aria-hidden
			/>
		);
	}

	// Fallback: empty span
	return <span />;
}

