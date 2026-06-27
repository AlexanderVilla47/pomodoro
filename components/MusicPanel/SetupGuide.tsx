"use client";

export function SetupGuide() {
  return (
    <div className="flex flex-col gap-4 p-6 rounded-2xl bg-white/5 border border-white/10">
      <h3 className="text-lg font-semibold text-white">Configurar YouTube Music</h3>
      <p className="text-sm text-white/60">
        Para conectar tus playlists necesitás una <strong className="text-white">YOUTUBE_API_KEY</strong>.
      </p>
      <ol className="text-sm text-white/60 list-decimal list-inside space-y-2">
        <li>
          Activá la YouTube Data API v3 en{" "}
          <span className="text-mint">Google Cloud Console</span>
        </li>
        <li>Creá una API key y copiala</li>
        <li>
          Agregala a tu archivo{" "}
          <code className="text-xs bg-white/10 px-1.5 py-0.5 rounded">.env.local</code>:
        </li>
      </ol>
      <pre className="bg-black/30 rounded-lg p-3 text-xs font-mono overflow-x-auto">
        <code>YOUTUBE_API_KEY=tu_clave_aquí</code>
      </pre>
      <p className="text-xs text-white/40">
        Reiniciá el servidor después de guardar el archivo.
      </p>
    </div>
  );
}
