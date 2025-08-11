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
}