export interface MarketOption {
  id: string;
  name: string;
  odds: number;
  probability: number;
  icon?: string;
  color: "green" | "red" | "blue" | "gray";
}

export interface Market {
  id: string;
  title: string;
  category: string;
  categoryIcon: string;
  image?: string;
  status: "live" | "closing" | "open" | "closed";
  timeLeft?: string;
  options: MarketOption[];
  type: "binary" | "multi";
  volume: number;
}

export const categories = [
  { id: "all", name: "Todos", icon: "dashboard" },
  { id: "entertainment", name: "Entretenimento", icon: "movie" },
  { id: "crypto", name: "Criptomoedas", icon: "currency_bitcoin" },
  { id: "sports", name: "Esportes", icon: "sports_soccer" },
  { id: "politics", name: "Política", icon: "account_balance" },
  { id: "finance", name: "Financeiro", icon: "trending_up" },
];

export const markets: Market[] = [
  {
    id: "1",
    title: "Bitcoin (5 minutos): sobe ou desce?",
    category: "Criptomoedas",
    categoryIcon: "currency_bitcoin",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Bitcoin.svg/128px-Bitcoin.svg.png",
    status: "live",
    timeLeft: "04:32",
    type: "binary",
    volume: 45230,
    options: [
      { id: "1_SOBE", name: "Sobe", odds: 7.4, probability: 13, color: "green" },
      { id: "1_DESCE", name: "Desce", odds: 1.09, probability: 87, color: "red" },
    ],
  },
  {
    id: "2",
    title: "Carlinhos: stories ativos às 19h (16/03)",
    category: "Entretenimento",
    categoryIcon: "movie",
    image: "https://ui-avatars.com/api/?name=C&background=e91e63&color=fff&size=80",
    status: "closing",
    timeLeft: "00:45",
    type: "multi",
    volume: 32100,
    options: [
      { id: "2_A", name: "Mais de 94", odds: 1.01, probability: 82.5, color: "green" },
      { id: "2_B", name: "26 a 60", odds: 13.57, probability: 6.1, color: "green" },
      { id: "2_C", name: "61 a 94", odds: 5.2, probability: 8.9, color: "green" },
      { id: "2_D", name: "Menos de 26", odds: 45.0, probability: 2.5, color: "green" },
    ],
  },
  {
    id: "3",
    title: "Serie A: Chapecoense vs Grêmio",
    category: "Esportes",
    categoryIcon: "sports_soccer",
    status: "open",
    timeLeft: "02h30",
    type: "multi",
    volume: 78500,
    options: [
      { id: "3_A", name: "Grêmio", odds: 1.75, probability: 47.4, color: "blue" },
      { id: "3_B", name: "Empate", odds: 2.55, probability: 32.5, color: "gray" },
      { id: "3_C", name: "Chapecoense", odds: 4.2, probability: 20.1, color: "green" },
    ],
  },
  {
    id: "4",
    title: "Ethereum (5 minutos): sobe ou desce?",
    category: "Criptomoedas",
    categoryIcon: "currency_bitcoin",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Ethereum-icon-purple.svg/128px-Ethereum-icon-purple.svg.png",
    status: "live",
    timeLeft: "03:15",
    type: "binary",
    volume: 28900,
    options: [
      { id: "4_SOBE", name: "Sobe", odds: 2.1, probability: 45, color: "green" },
      { id: "4_DESCE", name: "Desce", odds: 1.7, probability: 55, color: "red" },
    ],
  },
  {
    id: "5",
    title: "Lula aprovação acima de 35% em março?",
    category: "Política",
    categoryIcon: "account_balance",
    status: "open",
    timeLeft: "15d",
    type: "binary",
    volume: 120000,
    options: [
      { id: "5_SIM", name: "Sim", odds: 1.45, probability: 65, color: "green" },
      { id: "5_NAO", name: "Não", odds: 2.5, probability: 35, color: "red" },
    ],
  },
  {
    id: "6",
    title: "Dólar fecha acima de R$5.80 hoje?",
    category: "Financeiro",
    categoryIcon: "trending_up",
    status: "closing",
    timeLeft: "01:20",
    type: "binary",
    volume: 95000,
    options: [
      { id: "6_SIM", name: "Sim", odds: 1.85, probability: 52, color: "green" },
      { id: "6_NAO", name: "Não", odds: 1.95, probability: 48, color: "red" },
    ],
  },
];
