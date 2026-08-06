import React from 'react';

export default function HelpModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>✖</button>
        <h2>Opslagsværk & Hjælp ⛺</h2>
        
        <section>
          <h3>🔥 Popularitet & Trends</h3>
          <p>
            For at hjælpe dig med at finde ud af, hvor der er størst rift om pladserne, har vi introduceret en popularitetsscore. 
            Hvis en plads har et 🔥-ikon betyder det, at den har <strong>Høj efterspørgsel</strong> og ofte bliver booket lang tid i forvejen.
          </p>
        </section>

        <section>
          <h3>🛒 Indkøb & 🚌 Transport (POI)</h3>
          <p>
            Vi har beriget pladserne med afstandsbedømmelse til de vigtigste faciliteter, så du nemt kan planlægge din tur:
          </p>
          <ul>
            <li><strong>🛒 Supermarked:</strong> Viser afstanden (i fugleflugt) til nærmeste indkøbsmulighed.</li>
            <li><strong>🚌 Bus/Transport:</strong> Viser afstanden til nærmeste offentlige transport.</li>
          </ul>
        </section>

        <section>
          <h3>📱 Installer som App (PWA)</h3>
          <p>
            Landjord Overblik kan installeres direkte på din telefon! 
            På <strong>iOS (iPhone)</strong>: Åbn Safari, tryk på Del-ikonet i bunden og vælg "Føj til hjemmeskærm".
            På <strong>Android</strong>: Du vil automatisk få en prompt om at installere appen, eller du kan finde det i browsermenuen.
          </p>
        </section>
        
        <div className="modal-actions">
          <button onClick={onClose} className="primary-btn">Forstået!</button>
        </div>
      </div>
    </div>
  );
}
