import React, { useEffect, useRef } from "react";

const MoonBackground: React.FC = () => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		let animationId: number;

		const initCanvas = () => {
			const canvas = canvasRef.current;
			if (!canvas) return;

			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			const resizeCanvas = () => {
				canvas.width = window.innerWidth;
				canvas.height = window.innerHeight;
			};

			resizeCanvas();
			window.addEventListener("resize", resizeCanvas);

			type Star = {
				x: number;
				y: number;
				size: number;
				opacity: number;
			};

			const stars: Star[] = [];
			for (let i = 0; i < 200; i++) {
				stars.push({
					x: Math.random() * canvas.width,
					y: Math.random() * canvas.height,
					size: Math.random() * 2,
					opacity: Math.random() * 0.8 + 0.2,
				});
			}

			const drawCrater = (x: number, y: number, size: number) => {
				ctx.fillStyle = "rgba(180, 190, 210, 0.1)";
				ctx.beginPath();
				ctx.arc(x, y, size, 0, Math.PI * 2);
				ctx.fill();
			};

			const drawMoon = () => {
				const moonRadius = canvas.width * 0.15;
				const moonX = canvas.width * 0.8;
				const moonY = canvas.height * 0.2;

				const gradient = ctx.createRadialGradient(
					moonX,
					moonY,
					moonRadius * 0.9,
					moonX,
					moonY,
					moonRadius * 2
				);
				gradient.addColorStop(0, "rgba(200, 220, 255, 0.1)");
				gradient.addColorStop(1, "rgba(200, 220, 255, 0)");

				ctx.fillStyle = gradient;
				ctx.beginPath();
				ctx.arc(moonX, moonY, moonRadius * 2, 0, Math.PI * 2);
				ctx.fill();

				ctx.fillStyle = "rgba(220, 230, 240, 0.15)";
				ctx.beginPath();
				ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
				ctx.fill();

				drawCrater(moonX - moonRadius * 0.5, moonY - moonRadius * 0.3, moonRadius * 0.15);
				drawCrater(moonX + moonRadius * 0.3, moonY + moonRadius * 0.4, moonRadius * 0.1);
				drawCrater(moonX - moonRadius * 0.1, moonY + moonRadius * 0.2, moonRadius * 0.2);
			};

			const animate = () => {
				ctx.clearRect(0, 0, canvas.width, canvas.height);

				stars.forEach((star) => {
					ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
					ctx.beginPath();
					ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
					ctx.fill();

					star.opacity += (Math.random() - 0.5) * 0.01;
					star.opacity = Math.max(0.2, Math.min(1, star.opacity));
				});

				drawMoon();

				animationId = requestAnimationFrame(animate);
			};

			animate();

			return () => {
				window.removeEventListener("resize", resizeCanvas);
				cancelAnimationFrame(animationId);
			};
		};

		requestAnimationFrame(initCanvas);
	}, []);

	return <canvas ref={canvasRef} className="absolute inset-0 z-0 opacity-40" />;
};

export default MoonBackground;
