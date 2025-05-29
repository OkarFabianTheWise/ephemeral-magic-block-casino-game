import React from "react";

interface MoonIconProps extends React.SVGProps<SVGSVGElement> {}

export const MoonIcon: React.FC<MoonIconProps> = (props) => {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			{...props}
		>
			<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
			<circle cx="8" cy="9" r="1" fill="currentColor" />
			<circle cx="15" cy="12" r="0.5" fill="currentColor" />
			<circle cx="10" cy="14" r="0.75" fill="currentColor" />
		</svg>
	);
};
