export class HUD {
    render(ctx: CanvasRenderingContext2D, s1: number, s2?: number, hp1?: number, hp2?: number) {
        ctx.fillStyle = '#e8e8f0';
        ctx.font = '700 20px system-ui, sans-serif';
        if (typeof s2 === 'number') {
            ctx.fillText(`P1: ${s1}   P2: ${s2}`, 16, 24);
        } else {
            ctx.fillText(`Score: ${s1}`, 16, 24);
        }
        // HP hearts
        const drawHearts = (x: number, y: number, hp?: number) => {
            if (hp == null) return;
            for (let i = 0; i < hp; i++) {
                ctx.fillStyle = '#ff7b72';
                ctx.beginPath();
                const off = i * 18;
                ctx.moveTo(x + off + 6, y + 10);
                ctx.arc(x + off + 3, y + 8, 3, 0, Math.PI);
                ctx.arc(x + off + 9, y + 8, 3, 0, Math.PI);
                ctx.lineTo(x + off + 6, y + 14);
                ctx.closePath();
                ctx.fill();
            }
        };
        drawHearts(16, 36, hp1);
        if (hp2 != null) drawHearts(120, 36, hp2);
    }

    // Minimal status bar for cooldown and active power-ups
    renderStatus(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        cooldownFrac?: number,
        effects?: Array<{ label: string; color?: string; remain?: number }>
    ) {
        // Cooldown bar
        if (typeof cooldownFrac === 'number') {
            const clamped = Math.max(0, Math.min(1, cooldownFrac));
            const w = 120, h = 6;
            ctx.fillStyle = '#334155';
            ctx.fillRect(x, y, w, h);
            ctx.fillStyle = '#facc15';
            ctx.fillRect(x, y, w * (1 - clamped), h); // empty->full visual
            ctx.strokeStyle = '#0f172a';
            ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
        }
        // Active effect pills
        if (effects && effects.length) {
            let offX = 0;
            for (const e of effects) {
                const label = e.remain ? `${e.label} ${Math.ceil(e.remain!)}` : e.label;
                ctx.font = '700 10px system-ui, sans-serif';
                const tw = ctx.measureText(label).width;
                const padX = 6, padY = 3, r = 6;
                ctx.fillStyle = e.color || '#94a3b8';
                ctx.beginPath();
                // @ts-ignore roundRect exists on Canvas2D in modern browsers
                ctx.roundRect(x + offX, y + 10, tw + padX * 2, 16, r);
                ctx.fill();
                ctx.fillStyle = '#0f172a';
                ctx.fillText(label, x + offX + padX, y + 10 + 12);
                offX += tw + padX * 2 + 6;
            }
        }
    }
}