import SlotsMachine from "../components/SlotsMachine";

export default function Slots2p() {
  return <SlotsMachine gameId="slots" title="2p Machine" tagline="Low-stakes fun · Bets from 0.02 to 0.50 · Return to player 96.2%" minBet={0.02} maxBet={0.5} defaultBet={0.1} chips={[0.02, 0.05, 0.1, 0.5]} />;
}