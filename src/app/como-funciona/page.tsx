"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, CheckCircle, XCircle, ArrowRight, HelpCircle, Trophy, Bitcoin, Landmark, Gamepad2, Tv, Zap } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const faqs = [
  { q: "Preciso ter 18 anos para usar a plataforma?", a: "Sim, é obrigatório ter no mínimo 18 anos para utilizar a plataforma. Isso é verificado durante o cadastro." },
  { q: "Posso ganhar muito dinheiro?", a: "Sim, é possível ter retornos significativos dependendo das odds e do valor investido. Porém, lembre-se que também existe risco de perda." },
  { q: "Como funciona se eu acertar a previsão?", a: "Se você acertar, recebe o valor investido multiplicado pela odd. O valor é creditado automaticamente no seu saldo." },
  { q: "E se eu errar?", a: "Se você errar a previsão, perde o valor que investiu naquela previsão." },
  { q: "Quanto tempo leva para receber o dinheiro que ganhei?", a: "Após o evento ser resolvido, o valor é creditado automaticamente no seu saldo e pode ser sacado imediatamente." },
  { q: "Posso mudar minha previsão depois de fazer?", a: "Não é possível alterar uma previsão após confirmá-la. Por isso, pense bem antes de confirmar." },
];

const categories = [
  { name: "Esportes", desc: "Preveja sobre futebol, basquete, tênis e outros esportes!", tags: ["Copa do Mundo", "Brasileirão", "Champions League"], icon: Trophy, img: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=600&q=80" },
  { name: "Crypto", desc: "Preveja sobre Bitcoin, Ethereum e outras moedas digitais!", tags: ["Bitcoin", "Ethereum", "Tokens"], icon: Bitcoin, img: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=600&q=80" },
  { name: "Política", desc: "Preveja sobre eleições e decisões políticas!", tags: ["Eleições", "Governadores", "Senadores"], icon: Landmark, img: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=600&q=80" },
  { name: "E-Sports", desc: "Preveja sobre competições de videogames!", tags: ["CBLOL", "League of Legends", "CS:GO"], icon: Gamepad2, img: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80" },
  { name: "Social", desc: "Preveja sobre programas de TV, celebridades e internet!", tags: ["BBB", "Celebridades", "Eventos"], icon: Tv, img: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=600&q=80" },
  { name: "Fast Markets", desc: "Mercados que fecham muito rápido! Previsões em horas ou dias.", tags: ["Curto prazo", "Diários", "Rápidos"], icon: Zap, img: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&q=80" },
];

const steps = [
  { n: 1, title: "Escolha seu mercado", desc: "Navegue pelas categorias (Esportes, Política, Social, Crypto, etc.) e encontre um evento que você tem opinião sobre o resultado.", img: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&q=80" },
  { n: 2, title: "Escolha sua previsão: SIM ou NÃO", desc: "Cada mercado tem uma pergunta binária. Você só precisa decidir: aquele evento vai acontecer (SIM) ou não vai (NÃO)?", img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&q=80" },
  { n: 3, title: "Invista na sua intuição", desc: "Coloque um valor a partir de R$1 na opção que você acredita. Quanto maior o valor, maior o potencial de retorno.", img: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=500&q=80" },
  { n: 4, title: "Aguarde o evento acontecer", desc: "Acompanhe o mercado e veja as odds mudarem conforme mais pessoas fazem suas previsões.", img: "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=500&q=80" },
  { n: 5, title: "Receba sua recompensa", desc: "Se sua intuição estiver correta, você recebe o valor investido multiplicado pela odd. O prêmio é creditado automaticamente!", img: "https://images.unsplash.com/photo-1553729459-uj6dfbhg5ui?w=500&q=80" },
];

const doList = [
  { t: "Comece pequeno", d: "Coloque pouco dinheiro no início para aprender" },
  { t: "Estude antes de apostar", d: "Leia notícias sobre o assunto" },
  { t: "Diversifique", d: "Não coloque todo seu dinheiro em uma previsão" },
  { t: "Acompanhe os mercados", d: "Veja como as odds mudam" },
  { t: "Tenha paciência", d: "Nem sempre você vai ganhar na primeira" },
];

const dontList = [
  { t: "Não coloque dinheiro que não pode perder", d: "Isso é importante!" },
  { t: "Não aposte por emoção", d: "Pense com a cabeça, não com o coração" },
  { t: "Não tente recuperar perdas rápido", d: "Isso geralmente piora as coisas" },
  { t: "Não ignore as notícias", d: "Estude antes de fazer previsões" },
  { t: "Não coloque tudo em um único mercado", d: "Distribua seu dinheiro" },
];

export default function ComoFuncionaPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0d1117] text-white pb-20 lg:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0d1117]/95 backdrop-blur-xl border-b border-white/[0.04] h-14 flex items-center px-4 gap-3">
        <Link href="/" className="shrink-0"><img src="/logo.png" alt="PALPITEX" className="h-7 w-auto" /></Link>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="text-white/60 px-3 py-2 text-sm hover:text-white">Entrar</Link>
          <Link href="/criar-conta" className="bg-[#80FF00] text-[#0a0a0a] px-4 py-2 rounded-lg text-sm font-bold">Registrar</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Hero */}
        <section className="text-center py-12 sm:py-16">
          <span className="inline-block bg-[#80FF00]/10 text-[#80FF00] text-xs font-bold px-4 py-1.5 rounded-full border border-[#80FF00]/20 mb-6">GUIA COMPLETO</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight mb-4">
            Aprenda Tudo Sobre o<br />Mercado de Previsões
          </h1>
          <p className="text-white/40 text-sm sm:text-base max-w-xl mx-auto mb-8 leading-relaxed">
            Um guia super fácil de entender sobre previsões de mercado. Aprenda como funcionam as odds, as categorias, as taxas e comece a fazer suas primeiras previsões!
          </p>
          <a href="#o-que-e" className="inline-flex items-center gap-2 bg-[#80FF00] text-[#0a0a0a] px-6 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
            Começar a Aprender <ArrowRight size={16} />
          </a>
        </section>

        {/* O que é? */}
        <section id="o-que-e" className="py-10 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#80FF00] flex items-center justify-center"><HelpCircle size={20} className="text-[#0a0a0a]" /></div>
            <h2 className="text-2xl sm:text-3xl font-black">O que é?</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4 text-white/60 text-sm leading-relaxed">
              <p>Imagina você está dentro de uma plataforma onde <em className="text-[#80FF00] font-semibold not-italic">tudo é possível</em>, onde você pode prever qualquer tipo de acontecimento. Bom, você acabou de achar.</p>
              <div className="border-l-2 border-[#80FF00]/40 pl-4">
                <p>É um lugar na internet onde você pode fazer previsões sobre coisas que vão acontecer no futuro e ganhar dinheiro se acertar. De modo binário, apenas dizendo <strong className="text-white">SIM ou NÃO</strong> se aquele evento irá ocorrer.</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-3">Exemplos de previsões que você pode fazer:</p>
              {["Neymar vai ter outro filho em 2026?", "Qual time de futebol terá o maior número de visitantes em estádios em 2026?", "Virginia e Vini Jr irão anunciar casamento em 2026?", "Quem irá ganhar a eleição no Brasil?"].map((ex, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
                  <span className="text-lg">{["⚽", "🏟️", "💍", "🗳️"][i]}</span>
                  <span className="text-sm text-white/70">{ex}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Como Funciona - 5 passos */}
        <section className="py-10 border-t border-white/[0.06]">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-2">Como Funciona a Plataforma</h2>
          <p className="text-white/40 text-sm text-center mb-8">Em 5 passos simples você entende todo o processo</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {steps.map((s) => (
              <div key={s.n} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 flex flex-col">
                <div className="w-8 h-8 rounded-full bg-[#80FF00] flex items-center justify-center text-[#0a0a0a] font-black text-sm mb-3">{s.n}</div>
                <h3 className="text-base font-bold mb-2">{s.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed flex-1">{s.desc}</p>
                <div className="mt-4 rounded-xl overflow-hidden bg-white/[0.02] h-32">
                  <img src={s.img} alt={s.title} className="w-full h-full object-cover opacity-60" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Categorias */}
        <section className="py-10 border-t border-white/[0.06]">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-2">As Diferentes Categorias</h2>
          <p className="text-white/40 text-sm text-center mb-8">Escolha o tema que você mais domina</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div key={cat.name} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="h-36 overflow-hidden">
                  <img src={cat.img} alt={cat.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
                <div className="p-4">
                  <h3 className="text-base font-bold mb-1">{cat.name}</h3>
                  <p className="text-xs text-white/40 mb-3">{cat.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.tags.map((tag) => (
                      <span key={tag} className="text-[10px] text-white/50 bg-white/[0.04] border border-white/[0.06] px-2 py-1 rounded-md">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Taxas */}
        <section className="py-10 border-t border-white/[0.06]">
          <h2 className="text-2xl sm:text-3xl font-black mb-2">Informações Importantes sobre seu Dinheiro</h2>
          <div className="mt-6 space-y-4">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <h3 className="font-bold mb-2 border-b border-white/[0.06] pb-2">Somos uma corretora, não uma casa de apostas</h3>
              <p className="text-sm text-white/50 leading-relaxed">Antes de falar sobre taxas, é importante você entender: <strong className="text-white">a nossa plataforma não lucra quando você perde</strong>. Nós operamos como uma <strong className="text-white">corretora de mercados preditivos</strong>. Nosso papel é ser o intermediário que garante que tudo funcione de forma justa.</p>
            </div>
            <div>
              <h3 className="font-bold mb-3 flex items-center gap-2">Quais são as taxas? <span className="h-0.5 flex-1 bg-[#80FF00]/20" /></h3>
              {[
                { label: "Taxa de Depósito", value: "2%" },
                { label: "Taxa de Vitória", value: "0.36%" },
                { label: "Taxa de Saque", value: "2%" },
              ].map((fee) => (
                <div key={fee.label} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4 mb-2">
                  <span className="text-sm font-medium">{fee.label}</span>
                  <span className="text-sm font-bold text-[#80FF00] bg-[#80FF00]/10 px-3 py-1 rounded-lg">{fee.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <h3 className="font-bold mb-2 flex items-center gap-2">Valores mínimos para começar <span className="h-0.5 flex-1 bg-[#80FF00]/20" /></h3>
              <p className="text-sm text-white/50">Depósito mínimo: <strong className="text-white">R$ 1,00</strong></p>
              <p className="text-sm text-white/50">Previsão mínima: <strong className="text-white">R$ 1,00</strong></p>
            </div>
          </div>
        </section>

        {/* Dicas */}
        <section className="py-10 border-t border-white/[0.06]">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-2">Dicas Importantes</h2>
          <p className="text-white/40 text-sm text-center mb-8">O que fazer e o que evitar para ter sucesso</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white/[0.03] border border-emerald-500/20 rounded-2xl p-5">
              <h3 className="text-emerald-400 font-bold text-lg mb-4">O que FAZER</h3>
              <div className="space-y-3">
                {doList.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    <div><strong className="text-sm text-white">{item.t}</strong> <span className="text-xs text-white/40">- {item.d}</span></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/[0.03] border border-red-500/20 rounded-2xl p-5">
              <h3 className="text-red-400 font-bold text-lg mb-4">O que NÃO FAZER</h3>
              <div className="space-y-3">
                {dontList.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <div><strong className="text-sm text-white">{item.t}</strong> <span className="text-xs text-white/40">- {item.d}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-10 border-t border-white/[0.06]">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-2">Perguntas Frequentes</h2>
          <p className="text-white/40 text-sm text-center mb-8">Tire suas dúvidas sobre a plataforma</p>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left">
                  <span className="text-sm font-medium pr-4">{faq.q}</span>
                  <ChevronDown size={18} className={`text-white/30 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-white/50 leading-relaxed border-t border-white/[0.04] pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Resumo */}
        <section className="py-10 border-t border-white/[0.06]">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-6">Resumo Rápido</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="text-left text-[10px] text-white/30 uppercase tracking-wider font-semibold px-5 py-3">Aspecto</th>
                  <th className="text-left text-[10px] text-white/30 uppercase tracking-wider font-semibold px-5 py-3">Descrição</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  ["O que é", "Plataforma para fazer previsões sobre eventos reais e ganhar dinheiro se acertar"],
                  ["Como funciona", "Você escolhe SIM ou NÃO, coloca dinheiro e ganha se acertar"],
                  ["Categorias", "Esportes, Criptomoedas, Política, E-Sports, Social, Mercados Rápidos"],
                  ["Depósito mínimo", "R$ 1,00"],
                  ["Previsão mínima", "R$ 1,00"],
                  ["Taxa de Depósito", "2%"],
                  ["Taxa de Vitória", "0.36% (cobrada apenas ao ganhar)"],
                  ["Taxa de Saque", "2%"],
                  ["Idade mínima", "18 anos"],
                  ["Risco", "Você pode perder o dinheiro que colocou"],
                ].map(([aspect, desc], i) => (
                  <tr key={i} className="border-t border-white/[0.04]">
                    <td className="px-5 py-3 font-semibold text-white/80 whitespace-nowrap">{aspect}</td>
                    <td className="px-5 py-3 text-white/50">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* CTA Final */}
        <section className="py-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-black mb-3">Pronto para começar?</h2>
          <p className="text-white/40 text-sm mb-6">Crie sua conta e faça sua primeira previsão agora mesmo!</p>
          <Link href="/criar-conta" className="inline-flex items-center gap-2 bg-[#80FF00] text-[#0a0a0a] px-8 py-3.5 rounded-xl text-sm font-black hover:opacity-90 transition-opacity">
            Criar Conta Grátis <ArrowRight size={16} />
          </Link>
        </section>
      </div>

      <div className="lg:hidden"><BottomNav /></div>
    </div>
  );
}
