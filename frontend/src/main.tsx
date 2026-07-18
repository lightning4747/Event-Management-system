import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="h-12 w-12 bg-white/5 rounded-lg flex items-center justify-center mx-auto text-white border border-white/10">
          <span className="font-extrabold text-lg">MCET</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">AI&DS OD Approval</h1>
          <p className="text-sm text-muted-foreground">
            Digital On-Duty workflow management system template.
          </p>
        </div>
        <div className="pt-4 border-t border-border flex justify-center gap-4 text-xs font-semibold text-muted-foreground">
          <span>Vite + React</span>
          <span>•</span>
          <span>Tailwind CSS</span>
          <span>•</span>
          <span>TypeScript</span>
        </div>
      </div>
    </main>
  </React.StrictMode>
);
