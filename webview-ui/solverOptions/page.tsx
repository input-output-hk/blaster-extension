'use client'
import React from 'react';
import { createRoot } from 'react-dom/client'

export default function SolverOptions() {
    return (
        <h1>Solver Options</h1>
    )
}

createRoot(document.getElementById('solverOptions')!).render(
  <SolverOptions />,
)