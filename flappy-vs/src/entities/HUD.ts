export class HUD {
    render(ctx: CanvasRenderingContext2D, s1: number, s2?: number) {
        ctx.fillStyle = '#e8e8f0';
        ctx.font = '700 20px system-ui, sans-serif';
        if (typeof s2 === 'number') {
            ctx.fillText(`P1: ${s1}   P2: ${s2}`, 16, 24);
        } else {
            ctx.fillText(`Score: ${s1}`, 16, 24);
        }
    }
}