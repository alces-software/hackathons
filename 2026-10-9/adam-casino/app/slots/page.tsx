import SlotsMachine from "../components/SlotsMachine";

export default function Slots() {
  return <SlotsMachine gameId="slots" title="Moose Slots" tagline="Three reels · One payline · Return to player 96.2%" minBet={1} maxBet={100} defaultBet={25} chips={[10, 25, 50, 100]} />;
}
