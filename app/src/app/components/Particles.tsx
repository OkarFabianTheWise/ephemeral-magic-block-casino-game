import { JSX, useEffect, useState } from "react";
import Particles from "@tsparticles/react";
import { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Engine } from "@tsparticles/engine";

export default function ParticlesBackground(): JSX.Element | null {
	const [init, setInit] = useState(false);

	useEffect(() => {
		initParticlesEngine(async (engine: Engine) => {
			await loadSlim(engine);
		}).then(() => {
			setInit(true);
		});
	}, []);

	if (!init) return null;

	return (
		<div className="!-z-10 relative">
			<Particles
				id="tsparticles"
				options={{
					background: {
						color: { value: "transparent" },
					},
					fpsLimit: 150,
					particles: {
						color: { value: "#ffffff" },
						links: {
							color: "#ffffff",
							distance: 150,
							enable: true,
							opacity: 0.6,
							width: 1,
						},
						move: {
							direction: "none",
							enable: true,
							outModes: {
								default: "bounce",
							},
							random: false,
							speed: 1,
							straight: false,
						},
						number: {
							density: {
								enable: true,
								area: 800,
							},
							value: 50,
						},
						opacity: { value: 0.7 },
						shape: { type: "circle" },
						size: {
							value: { min: 1, max: 3 },
						},
					},
					detectRetina: true,
				}}
			/>
		</div>
	);
}
