export default function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="landing">
      <div className="landing-inner">
        <h1>Tumbleweed Trend Detective</h1>
        <p className="fine">
          25 years of NASA Earth observations, tested for real trends
        </p>

        <div className="hero">
          <div>
            <blockquote className="quote">
              "People woke up Saturday morning and it looked like these huge walls had been
              erected made of tumbleweed. We had entire streets in some of our neighborhoods
              completely blocked."
              <cite>Dawn Ramsey, Mayor of South Jordan, Utah &mdash; March 2024</cite>
            </blockquote>

            <ul className="costs">
              <li><b>Homes buried.</b> Up to 150 houses in Victorville, California, piles reaching the second storey.</li>
              <li><b>Roads closed.</b> Highway 240 in Washington shut both directions for 10 hours, five cars and a semi-truck trapped.</li>
              <li><b>Crews and equipment.</b> Four agencies mobilised, snowplows, front loaders, a week of municipal cleanup.</li>
              <li><b>Wildfire fuel.</b> Dry piles against fences and ditches ignite and blow onward, carrying fire past firebreaks.</li>
            </ul>

            <button className="cta" onClick={onEnter}>Our Solution</button>
          </div>

          <figure className="shot" style={{ margin: 0 }}>
            <span className="fine">
              Drop a photo at <code>public/hero.jpg</code> and it appears here
            </span>
          </figure>
        </div>
      </div>
    </div>
  );
}
