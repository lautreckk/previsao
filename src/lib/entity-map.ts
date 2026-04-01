export interface EntityEntry {
  name: string;
  aliases: string[];
  image_url: string;
  type: "person" | "team" | "brand" | "crypto";
}

export const ENTITY_MAP: EntityEntry[] = [
  // ── Politicians ──────────────────────────────────────────────────────
  {
    name: "Luiz Inácio Lula da Silva",
    aliases: ["lula", "lulinha"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Reversa1.jpg/330px-Reversa1.jpg",
    type: "person",
  },
  {
    name: "Jair Bolsonaro",
    aliases: ["bolsonaro"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Jair_Bolsonaro_2019_Portrait_%283x4_cropped_center%29.jpg/330px-Jair_Bolsonaro_2019_Portrait_%283x4_cropped_center%29.jpg",
    type: "person",
  },
  {
    name: "Tarcísio de Freitas",
    aliases: ["tarcisio", "tarcísio"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Governador_do_Estado_de_S%C3%A3o_Paulo%2C_Tarc%C3%ADsio_de_Freitas_-_Foto_Oficial_%28cropped%29.jpg/330px-Governador_do_Estado_de_S%C3%A3o_Paulo%2C_Tarc%C3%ADsio_de_Freitas_-_Foto_Oficial_%28cropped%29.jpg",
    type: "person",
  },
  {
    name: "Ciro Gomes",
    aliases: ["ciro"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Ciro_Gomes_em_setembro_de_2022_%28cropped%29.jpg/220px-Ciro_Gomes_em_setembro_de_2022_%28cropped%29.jpg",
    type: "person",
  },
  {
    name: "Simone Tebet",
    aliases: ["tebet"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Simone_Tebet_em_2023_%28cropped%29.jpg/220px-Simone_Tebet_em_2023_%28cropped%29.jpg",
    type: "person",
  },
  {
    name: "Marina Silva",
    aliases: ["marina silva"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Marina_Silva_2023_%28cropped%29.jpg/220px-Marina_Silva_2023_%28cropped%29.jpg",
    type: "person",
  },
  {
    name: "Fernando Haddad",
    aliases: ["haddad"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Fernando_Haddad_foto_oficial_%28cropped%29.jpg/220px-Fernando_Haddad_foto_oficial_%28cropped%29.jpg",
    type: "person",
  },
  {
    name: "Flávio Dino",
    aliases: ["flavio dino", "flávio dino"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Fl%C3%A1vio_Dino_em_janeiro_de_2023_%28cropped%29.jpg/220px-Fl%C3%A1vio_Dino_em_janeiro_de_2023_%28cropped%29.jpg",
    type: "person",
  },
  {
    name: "André Valadão",
    aliases: ["valadao", "valadão", "andre valadao"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Andr%C3%A9_Valad%C3%A3o_em_2019.jpg/220px-Andr%C3%A9_Valad%C3%A3o_em_2019.jpg",
    type: "person",
  },

  // ── Entertainment / Influencers ──────────────────────────────────────
  {
    name: "Virginia Fonseca",
    aliases: ["virginia"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Virginia_Fonseca_na_CPI_das_BETS_02_%28cropped%29.jpg/330px-Virginia_Fonseca_na_CPI_das_BETS_02_%28cropped%29.jpg",
    type: "person",
  },
  {
    name: "Carlinhos Maia",
    aliases: ["carlinhos"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Carlinhos_Maia.jpg/330px-Carlinhos_Maia.jpg",
    type: "person",
  },
  {
    name: "Casimiro Miguel",
    aliases: ["casimiro", "cazé"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Casimiro.png/330px-Casimiro.png",
    type: "person",
  },
  {
    name: "Felipe Neto",
    aliases: ["felipe neto"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Felipe_Neto_at_the_Lady_Night_in_2022_%2801%29.png/330px-Felipe_Neto_at_the_Lady_Night_in_2022_%2801%29.png",
    type: "person",
  },
  {
    name: "Whindersson Nunes",
    aliases: ["whindersson"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Whindersson_Nunes_em_2018.jpg/220px-Whindersson_Nunes_em_2018.jpg",
    type: "person",
  },
  {
    name: "Anitta",
    aliases: ["anitta"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Anitta_for_Attractive_Mindset_podcast_02.jpg/330px-Anitta_for_Attractive_Mindset_podcast_02.jpg",
    type: "person",
  },
  {
    name: "Neymar Jr",
    aliases: ["neymar"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Neymar_Jr._with_Al_Hilal%2C_3_October_2023_-_03_%28cropped%29.jpg/330px-Neymar_Jr._with_Al_Hilal%2C_3_October_2023_-_03_%28cropped%29.jpg",
    type: "person",
  },
  {
    name: "IZA",
    aliases: ["iza"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/IZA_em_2019_%28cropped%29.jpg/220px-IZA_em_2019_%28cropped%29.jpg",
    type: "person",
  },
  {
    name: "Ludmilla",
    aliases: ["ludmilla"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Ludmilla_em_2019_%28cropped%29.jpg/220px-Ludmilla_em_2019_%28cropped%29.jpg",
    type: "person",
  },
  {
    name: "Gisele Bündchen",
    aliases: ["gisele", "bundchen", "bündchen"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Gisele_B%C3%BCndchen_at_the_2019_Met_Gala_%28cropped%29.jpg/220px-Gisele_B%C3%BCndchen_at_the_2019_Met_Gala_%28cropped%29.jpg",
    type: "person",
  },
  {
    name: "Chappell Roan",
    aliases: ["chappell roan"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Chappell_Roan_at_Lollapalooza_2024_%28cropped%29.jpg/220px-Chappell_Roan_at_Lollapalooza_2024_%28cropped%29.jpg",
    type: "person",
  },
  {
    name: "Floyd Mayweather",
    aliases: ["mayweather", "floyd"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Floyd_Mayweather_Jr._at_DeWalt_event_%28cropped%29.jpg/220px-Floyd_Mayweather_Jr._at_DeWalt_event_%28cropped%29.jpg",
    type: "person",
  },
  {
    name: "Manny Pacquiao",
    aliases: ["pacquiao", "manny"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Manny_Pacquiao_in_2021_%28cropped%29.jpg/220px-Manny_Pacquiao_in_2021_%28cropped%29.jpg",
    type: "person",
  },
  {
    name: "Ramon Dino",
    aliases: ["ramon dino"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Ramon_Dino_em_2023.jpg/220px-Ramon_Dino_em_2023.jpg",
    type: "person",
  },
  {
    name: "GTA VI",
    aliases: ["gta vi", "gta 6"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Rockstar_Games_Logo.svg/220px-Rockstar_Games_Logo.svg.png",
    type: "brand",
  },

  // ── Brazilian Football Teams ─────────────────────────────────────────
  {
    name: "Flamengo",
    aliases: ["flamengo", "fla"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Clube_de_Regatas_do_Flamengo_logo.svg/langpt-330px-Clube_de_Regatas_do_Flamengo_logo.svg.png",
    type: "team",
  },
  {
    name: "Corinthians",
    aliases: ["corinthians", "corin"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/pt/thumb/b/b4/Corinthians_simbolo.png/330px-Corinthians_simbolo.png",
    type: "team",
  },
  {
    name: "Palmeiras",
    aliases: ["palmeiras"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/SE_Palmeiras_2025_crest.png/330px-SE_Palmeiras_2025_crest.png",
    type: "team",
  },
  {
    name: "São Paulo FC",
    aliases: ["sao paulo"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Brasao_do_Sao_Paulo_Futebol_Clube.svg/220px-Brasao_do_Sao_Paulo_Futebol_Clube.svg.png",
    type: "team",
  },
  {
    name: "Santos FC",
    aliases: ["santos"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Santos_Logo.png/220px-Santos_Logo.png",
    type: "team",
  },
  {
    name: "Grêmio",
    aliases: ["gremio", "grêmio"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Gremio_logo.svg/220px-Gremio_logo.svg.png",
    type: "team",
  },
  {
    name: "Internacional",
    aliases: ["internacional", "inter"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Escudo_do_Sport_Club_Internacional.svg/220px-Escudo_do_Sport_Club_Internacional.svg.png",
    type: "team",
  },
  {
    name: "Atlético Mineiro",
    aliases: ["atletico-mg", "atlético", "galo"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Atletico_mineiro_galo.png/330px-Atletico_mineiro_galo.png",
    type: "team",
  },
  {
    name: "Cruzeiro",
    aliases: ["cruzeiro"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/langpt-330px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png",
    type: "team",
  },
  {
    name: "Botafogo",
    aliases: ["botafogo", "botaf"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Botafogo_de_Futebol_e_Regatas_logo.svg/langpt-330px-Botafogo_de_Futebol_e_Regatas_logo.svg.png",
    type: "team",
  },
  {
    name: "Fluminense",
    aliases: ["fluminense", "flu"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Fluminense_Football_Club.svg/langpt-330px-Fluminense_Football_Club.svg.png",
    type: "team",
  },
  {
    name: "Vasco da Gama",
    aliases: ["vasco"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/pt/thumb/8/8b/EscudoDoVascoDaGama.svg/langpt-330px-EscudoDoVascoDaGama.svg.png",
    type: "team",
  },
  {
    name: "Coritiba",
    aliases: ["coritiba"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Coritiba_FBC_Logo.svg/220px-Coritiba_FBC_Logo.svg.png",
    type: "team",
  },

  // ── Football Players & International Clubs ───────────────────────────
  {
    name: "Vinicius Jr",
    aliases: ["vinicius", "vini jr"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/2023_05_06_Final_de_la_Copa_del_Rey_-_52879242230_%28cropped%29.jpg/330px-2023_05_06_Final_de_la_Copa_del_Rey_-_52879242230_%28cropped%29.jpg",
    type: "person",
  },
  {
    name: "Endrick",
    aliases: ["endrick"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Endrick-Palmeiras-Liverpool-abr24.jpg/330px-Endrick-Palmeiras-Liverpool-abr24.jpg",
    type: "person",
  },
  {
    name: "Real Madrid",
    aliases: ["real madrid"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/220px-Real_Madrid_CF.svg.png",
    type: "team",
  },
  {
    name: "FC Barcelona",
    aliases: ["barcelona"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/220px-FC_Barcelona_%28crest%29.svg.png",
    type: "team",
  },

  // ── Crypto ───────────────────────────────────────────────────────────
  {
    name: "Bitcoin",
    aliases: ["bitcoin", "btc"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Bitcoin.svg/220px-Bitcoin.svg.png",
    type: "crypto",
  },
  {
    name: "Ethereum",
    aliases: ["ethereum", "eth"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Ethereum-icon-purple.svg/220px-Ethereum-icon-purple.svg.png",
    type: "crypto",
  },
  {
    name: "Solana",
    aliases: ["solana", "sol"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/en/thumb/b/b9/Solana_logo.png/220px-Solana_logo.png",
    type: "crypto",
  },

  // ── Brands / Companies ───────────────────────────────────────────────
  {
    name: "Petrobras",
    aliases: ["petrobras", "petr4", "petr"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Petrobras_horizontal_logo_%282%29.svg/220px-Petrobras_horizontal_logo_%282%29.svg.png",
    type: "brand",
  },
  {
    name: "Vale S.A.",
    aliases: ["vale3"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Logo_Vale.svg/220px-Logo_Vale.svg.png",
    type: "brand",
  },
  {
    name: "B3 - Brasil Bolsa Balcão",
    aliases: ["ibovespa", "bovespa", "b3"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/B3_logo.svg/220px-B3_logo.svg.png",
    type: "brand",
  },
  {
    name: "Itaú Unibanco",
    aliases: ["itub4", "itau"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Banco_Ita%C3%BA_logo.svg/220px-Banco_Ita%C3%BA_logo.svg.png",
    type: "brand",
  },

  // ── Forex / Economy ─────────────────────────────────────────────────
  {
    name: "Dólar Americano",
    aliases: ["dolar", "dollar", "usd/brl", "usd"],
    image_url:
      "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400&q=80",
    type: "brand",
  },
  {
    name: "Petróleo",
    aliases: ["petroleo", "barril", "brent", "wti"],
    image_url:
      "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=400&q=80",
    type: "brand",
  },

  // ── Sports (generic) ───────────────────────────────────────────────
  {
    name: "Brasileirão",
    aliases: ["brasileirao", "serie a"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/pt/thumb/4/42/Brasileir%C3%A3o_S%C3%A9rie_A_logo.png/200px-Brasileir%C3%A3o_S%C3%A9rie_A_logo.png",
    type: "brand",
  },
  {
    name: "Copa do Brasil",
    aliases: ["copa do brasil"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/pt/thumb/6/62/Copa_do_Brasil_logo.png/200px-Copa_do_Brasil_logo.png",
    type: "brand",
  },
  {
    name: "Copa do Mundo",
    aliases: ["copa do mundo", "world cup"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/pt/thumb/e/e0/2026_FIFA_World_Cup_emblem.svg/200px-2026_FIFA_World_Cup_emblem.svg.png",
    type: "brand",
  },
  {
    name: "Seleção Brasileira",
    aliases: ["selecao", "seleção"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Bandeira_da_Confedera%C3%A7%C3%A3o_Brasileira_de_Futebol.svg/200px-Bandeira_da_Confedera%C3%A7%C3%A3o_Brasileira_de_Futebol.svg.png",
    type: "brand",
  },

  // ── Football Teams (missing) ───────────────────────────────────────
  {
    name: "Flamengo",
    aliases: ["flamengo"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Flamengo_bridge_logo.svg/200px-Flamengo_bridge_logo.svg.png",
    type: "team",
  },
  {
    name: "Corinthians",
    aliases: ["corinthians"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/pt/thumb/b/b4/Corinthians_simbolo.png/200px-Corinthians_simbolo.png",
    type: "team",
  },
  {
    name: "Palmeiras",
    aliases: ["palmeiras"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Palmeiras_logo.svg/200px-Palmeiras_logo.svg.png",
    type: "team",
  },
  {
    name: "Vasco da Gama",
    aliases: ["vasco"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Vasco_da_Gama_logo.svg/200px-Vasco_da_Gama_logo.svg.png",
    type: "team",
  },
  {
    name: "Botafogo",
    aliases: ["botafogo"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Botafogo_de_Futebol_e_Regatas_logo.svg/200px-Botafogo_de_Futebol_e_Regatas_logo.svg.png",
    type: "team",
  },
  {
    name: "Fluminense",
    aliases: ["fluminense"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Fluminense_FC_logo.svg/200px-Fluminense_FC_logo.svg.png",
    type: "team",
  },
  {
    name: "Atlético Mineiro",
    aliases: ["atletico-mg", "atletico", "galo"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Clube_Atletico_Mineiro_logo.svg/200px-Clube_Atletico_Mineiro_logo.svg.png",
    type: "team",
  },
  {
    name: "Cruzeiro",
    aliases: ["cruzeiro"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/200px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png",
    type: "team",
  },
  {
    name: "Internacional",
    aliases: ["internacional", "inter"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Logo_Internacional_Porto_Alegre.svg/200px-Logo_Internacional_Porto_Alegre.svg.png",
    type: "team",
  },
  {
    name: "Grêmio",
    aliases: ["gremio", "grêmio"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Gremio_logo.svg/200px-Gremio_logo.svg.png",
    type: "team",
  },
  {
    name: "Coritiba",
    aliases: ["coritiba"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Coritiba_FBC_-_badge.svg/200px-Coritiba_FBC_-_badge.svg.png",
    type: "team",
  },

  // ── Entertainment / Influencers ────────────────────────────────────
  {
    name: "Neymar Jr",
    aliases: ["neymar"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/20180610_FIFA_Friendly_Match_Austria_vs._Brazil_Neymar_850_1705_%28cropped%29.jpg/200px-20180610_FIFA_Friendly_Match_Austria_vs._Brazil_Neymar_850_1705_%28cropped%29.jpg",
    type: "person",
  },
  {
    name: "Virginia Fonseca",
    aliases: ["virginia", "virgínia"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Virginia_Fonseca_in_December_2023.jpg/200px-Virginia_Fonseca_in_December_2023.jpg",
    type: "person",
  },
  {
    name: "Carlinhos Maia",
    aliases: ["carlinhos maia", "carlinhos"],
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Carlinhos_Maia.jpg/200px-Carlinhos_Maia.jpg",
    type: "person",
  },
];
