import type { Ref } from 'react';

/**
 * HeroArt — o objeto visual principal da Home.
 *
 * Uma composição 3D (CSS) que conta a história do produto:
 * "uma conta sendo dividida entre amigos".
 *
 *  · o recibo de papel (receipt) com os pedidos, o total e a divisão
 *  · três amigos (chips de avatar) ao redor da mesa, em profundidades reais
 *
 * 100% apresentacional: sem estado, sem lógica, sem idioma no texto interno
 * (é textura visual, como uma ilustração). O floating/tilt/glow são
 * controlados pela HomeScreen via GSAP, usando as classes abaixo.
 *
 * PARA TROCAR POR UM ASSET REAL (imagem/3D) no futuro: substitua o JSX do
 * `.hero-art__scene` por um <img>/canvas preservando a mesma hierarquia —
 * `.hero-art > .hero-art__glow + .hero-art__scene` — para manter o glow, o
 * tilt 3D e o floating que já funcionam.
 */
export function HeroArt({ sceneRef, splitLabel }: { sceneRef?: Ref<HTMLDivElement>; splitLabel?: string }) {
  return (
    <div className="hero-art" aria-hidden="true">
      {/* Luz ambiente concentrada atrás do objeto. */}
      <span className="hero-art__glow" />
      <div className="hero-art__scene" ref={sceneRef}>
        {/* Sombra que ancora o objeto no "chão" da cena. */}
        <span className="hero-art__shadow" />

        {/* O recibo — papel claro, a peça central. */}
        <div className="receipt">
          <div className="receipt__brand">
            <span className="receipt__orb" />
            <span className="receipt__brand-name">DIVIDE AÊ!</span>
          </div>

          <div className="receipt__rows">
            <div className="receipt__row">
              <span className="receipt__qty">2</span>
              <span className="receipt__name">Chopp</span>
              <span className="receipt__val">R$ 14,00</span>
            </div>
            <div className="receipt__row">
              <span className="receipt__qty">1</span>
              <span className="receipt__name">Pizza margherita</span>
              <span className="receipt__val">R$ 42,00</span>
            </div>
            <div className="receipt__row">
              <span className="receipt__qty">1</span>
              <span className="receipt__name">Porção de fritas</span>
              <span className="receipt__val">R$ 28,00</span>
            </div>
          </div>

          <div className="receipt__rule" />

          <div className="receipt__total">
            <span className="receipt__total-label">TOTAL</span>
            <strong className="receipt__total-val">R$ 84,00</strong>
          </div>

          {/* A história: dividido entre amigos. */}
          <div className="receipt__split">
            <span className="receipt__split-av">3</span>
            <span>{splitLabel ?? '3 amigos · R$ 28,00 cada'}</span>
          </div>
        </div>

        {/* Amigos ao redor da mesa. */}
        <span className="hero-chip hero-chip--1">AV</span>
        <span className="hero-chip hero-chip--2">BE</span>
        <span className="hero-chip hero-chip--3">CA</span>
      </div>
    </div>
  );
}
