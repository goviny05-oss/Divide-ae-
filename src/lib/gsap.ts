import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// registerPlugin é idempotente — seguro sob hot-reload do Vite.
gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };
