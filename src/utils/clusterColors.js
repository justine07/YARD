function clusterHsl(clusterId) {
  if (Number(clusterId) < 0) {
    return { h: 210, s: 7, l: 58 };
  }
  const hue = (Number(clusterId) * 137.508) % 360;
  return { h: hue, s: 63, l: 57 };
}

export function clusterColor(clusterId, alpha = 1) {
  const { h, s, l } = clusterHsl(clusterId);
  return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
}

export function clusterLabel(clusterId) {
  return Number(clusterId) < 0 ? 'Noise' : `Cluster ${Number(clusterId) + 1}`;
}

export function clusterShortLabel(clusterId) {
  return Number(clusterId) < 0 ? 'Noise' : `C${Number(clusterId) + 1}`;
}

export function sortClusterIds(ids) {
  return [...ids].sort((left, right) => {
    const leftValue = Number(left);
    const rightValue = Number(right);
    if (leftValue < 0 && rightValue < 0) return 0;
    if (leftValue < 0) return 1;
    if (rightValue < 0) return -1;
    return leftValue - rightValue;
  });
}
