const EARTH_RADIUS_M = 6371000;
const GPS_VERIFY_RADIUS_M = Number(process.env.GPS_VERIFY_RADIUS_M) || 50;

export function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function verifyGpsCheckIn(agentLat, agentLng, checkInLat, checkInLng) {
  if (
    checkInLat == null ||
    checkInLng == null ||
    agentLat == null ||
    agentLng == null
  ) {
    return { verified: false, distanceMeters: null };
  }

  const distance = distanceMeters(agentLat, agentLng, checkInLat, checkInLng);
  return {
    verified: distance <= GPS_VERIFY_RADIUS_M,
    distanceMeters: Math.round(distance)
  };
}

export { GPS_VERIFY_RADIUS_M };
