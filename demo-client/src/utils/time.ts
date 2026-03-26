export const renderCountdown = (nowTS: number, startTime: number, endTime: number) => {
    const effectiveStart = startTime + 30;
    if (nowTS < effectiveStart) {
        const diff = effectiveStart - nowTS;
        return `Starts in ${Math.floor(diff / 60)}m ${diff % 60}s`;
    } else if (nowTS <= endTime) {
        const diff = endTime - nowTS;
        return `Ends in ${Math.floor(diff / 60)}m ${diff % 60}s`;
    }
    return "Event Ended";
};
