export const getTableSeatLayout = (seats = []) => {
  const [topSeat, ...sideSeats] = seats;
  const leftCount = Math.ceil(sideSeats.length / 2);

  return {
    topSeat: topSeat ?? null,
    leftSeats: sideSeats.slice(0, leftCount),
    rightSeats: sideSeats.slice(leftCount),
    maxSideCount: leftCount,
  };
};
