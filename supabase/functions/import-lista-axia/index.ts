import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PIPELINE_ID = "2de90016-ff26-48d3-af69-9ef1480cd506";
const STAGE_ID = "c904d4ef-1071-443d-983d-42c33cd2d8af";
const OWNER_ID = "221ec231-ad88-4514-b9f1-8170679483b7";
const EMPRESA = "BLUE_LABS";

interface Lead {
  fn: string; ln: string; job: string; company: string; email: string; phone: string; industry: string; linkedin: string; city: string;
}

const DATA: Lead[] = [
  {fn:"Thiago",ln:"Pinho",job:"CEO",company:"RubPay",email:"thiago.pinho@rubpay.com.br",phone:"(11) 99493-8053",industry:"financial services",linkedin:"http://www.linkedin.com/in/tpinho",city:"Sao Paulo"},
  {fn:"Luis",ln:"Januario",job:"Founder e CEO",company:"Avanti Open Banking",email:"fernando@avantiopenbanking.com.br",phone:"(19) 3512-9636",industry:"financial services",linkedin:"http://www.linkedin.com/in/luis-fernando-januario-33913371",city:"Sao Paulo"},
  {fn:"Cleumir",ln:"Junior",job:"CEO",company:"Grupo Valor",email:"junior@grupovalor.com.br",phone:"(31) 99526-4623",industry:"banking",linkedin:"http://www.linkedin.com/in/cleumir-marques-j%c3%banior-667164359",city:""},
  {fn:"Roni",ln:"Volyk",job:"IT Coordinator",company:"Aditus Consultoria Financeira",email:"roni.volyk@aditusbr.com",phone:"(11) 3818-1111",industry:"financial services",linkedin:"http://www.linkedin.com/in/ronivolyk",city:"Sao Paulo"},
  {fn:"Breno",ln:"Casiuch",job:"Chief Executive Officer",company:"Nikos Investimentos",email:"breno.casiuch@nikos.com.br",phone:"(21) 98662-2011",industry:"investment banking",linkedin:"http://www.linkedin.com/in/breno-casiuch-026b61a4",city:"Rio de Janeiro"},
  {fn:"Valter",ln:"Viana",job:"CEO",company:"iDtrust",email:"valter.viana@wba.com.br",phone:"(16) 3106-9005",industry:"financial services",linkedin:"http://www.linkedin.com/in/valterviana",city:"Sao Paulo"},
  {fn:"Dudu",ln:"Cearense",job:"Chief Executive Officer",company:"Okto Investimentos",email:"dudu.cearense@oktoinvestimentos.com.br",phone:"(11) 2142-0409",industry:"financial services",linkedin:"http://www.linkedin.com/in/dudu-cearense",city:"Sao Paulo"},
  {fn:"Eladio",ln:"Isoppo",job:"CEO",company:"Payface",email:"eladio@payface.com.br",phone:"(11) 5039-4374",industry:"financial services",linkedin:"http://www.linkedin.com/in/eladioisoppo",city:"Sao Paulo"},
  {fn:"Bruno",ln:"Lopes",job:"Sócio e Diretor Comercial",company:"Acreditar FIDC",email:"brunocosmo@acreditarfidc.com.br",phone:"(11) 4312-0264",industry:"banking",linkedin:"http://www.linkedin.com/in/bruno-cosmo-acreditar-banco",city:"Sao Paulo"},
  {fn:"Maria",ln:"Medeiros",job:"Commercial Supervisor",company:"GazinBank",email:"maria.medeiros@gazin.com.br",phone:"(44) 8848-8282",industry:"banking",linkedin:"http://www.linkedin.com/in/maria-eduarda-medeiros-b72898203",city:""},
  {fn:"Marcos",ln:"Costa",job:"CEO",company:"The Fortune.one",email:"marcos@thefortune.one",phone:"(11) 4210-6093",industry:"investment management",linkedin:"http://www.linkedin.com/in/marcos-costa-99853914",city:"Sao Paulo"},
  {fn:"Rodrigo",ln:"Machado",job:"CEO",company:"Vidda Capital",email:"rm@viddacapital.com.br",phone:"(11) 4502-4135",industry:"financial services",linkedin:"http://www.linkedin.com/in/rodrigofm",city:"Sao Paulo"},
  {fn:"Mauricio",ln:"Seixas",job:"CEO",company:"DubPay",email:"mauricio.seixas@dubpay.com.br",phone:"(61) 99328-6388",industry:"financial services",linkedin:"http://www.linkedin.com/in/mauricio-seixas",city:""},
  {fn:"Rafael",ln:"Marques",job:"CEO",company:"Philos Invest & Solutions",email:"rafael.marques@philosinvest.com.br",phone:"(21) 99428-7693",industry:"financial services",linkedin:"http://www.linkedin.com/in/rafael-viana-marques-a3274b8a",city:"Rio de Janeiro"},
  {fn:"Murilo",ln:"Sabel",job:"CEO",company:"CredFlex Financeira",email:"murilo@credflexfinanceira.com.br",phone:"(18) 98156-7754",industry:"banking",linkedin:"http://www.linkedin.com/in/murilo-sabel-503839303",city:""},
  {fn:"Robertson",ln:"Rodrigues",job:"IT Coordinator",company:"Sicoob Credipel",email:"robertson.rodrigues@sicoobcredipel.com.br",phone:"(31) 3660-3000",industry:"financial services",linkedin:"http://www.linkedin.com/in/robertson-rodrigues-85a28620a",city:"Pedro Leopoldo"},
  {fn:"Marcelo",ln:"Casati",job:"IT Coordinator",company:"Tupi Brazil Solution",email:"casati@mailtupi.com.br",phone:"(11) 94499-0000",industry:"financial services",linkedin:"http://www.linkedin.com/in/marcelo-casati-84680921",city:"Sao Paulo"},
  {fn:"Pedro",ln:"Oliveira",job:"CEO",company:"Delta Global Bank",email:"pedro.ricco@deltainvestor.com.br",phone:"(11) 92140-1855",industry:"banking",linkedin:"http://www.linkedin.com/in/pedro-henrique-ricco-oliveira-msc-cfp%c2%ae-90585b52",city:"Sao Paulo"},
  {fn:"Bruna",ln:"Risden",job:"Coordenador Comercial e adm",company:"Merchant Cobrancas",email:"bruna.risden@merchant.com.br",phone:"(11) 99575-2096",industry:"financial services",linkedin:"http://www.linkedin.com/in/bruna-risden-a6797157",city:"Sao Paulo"},
  {fn:"Tatiana",ln:"Schuartz",job:"Commercial Supervisor",company:"Santinvest",email:"tatiana.schuartz@santinvest.com.br",phone:"(47) 3433-6767",industry:"financial services",linkedin:"http://www.linkedin.com/in/tatiana-schuartz-2b219227a",city:"Blumenau"},
  {fn:"Henrique",ln:"Pessoa",job:"Scio/Diretor Comercial",company:"LFS Financial Advisory",email:"henrique.pessoa@lexusfinancial.com",phone:"(31) 9 8752-2793",industry:"financial services",linkedin:"http://www.linkedin.com/in/henrique-pessoa-326812109",city:"Belo Horizonte"},
  {fn:"Valter",ln:"Goncalves",job:"Commercial Supervisor",company:"AL5 AMAGGI",email:"valter.goncalves@al5bank.com.br",phone:"(65) 98403-0937",industry:"banking",linkedin:"http://www.linkedin.com/in/valter-lemes-gon%c3%a7alves-808b8971",city:"Cuiaba"},
  {fn:"Otavio",ln:"Carvalho",job:"IT Coordinator",company:"Sicoob Credisg",email:"otavio.carvalho@sicoobcredisg.com.br",phone:"(48) 3462-7700",industry:"financial services",linkedin:"http://www.linkedin.com/in/ot%c3%a1vio-l-carvalho-b2a19129b",city:"Sao Gotardo"},
  {fn:"Jarbas",ln:"Gageiro",job:"CEO",company:"Orla Investimentos",email:"jarbas.gageiro@orlainvestimentos.com",phone:"(21) 99909-7028",industry:"financial services",linkedin:"http://www.linkedin.com/in/jarbas-gageiro",city:"Rio de Janeiro"},
  {fn:"Manuela",ln:"Rodrigues",job:"Commercial Coordinator",company:"Truck Digital",email:"manuela.rodrigues@truckdigital.com.br",phone:"(81) 97109-4874",industry:"financial services",linkedin:"http://www.linkedin.com/in/manuela-gestaocomercial",city:"Recife"},
  {fn:"Felipe",ln:"Franchi",job:"CEO",company:"Franchi Fintech",email:"felipe@franchibank.com",phone:"(51) 35086301",industry:"banking",linkedin:"http://www.linkedin.com/in/felipe-franchi-6129b326",city:"Porto Alegre"},
  {fn:"Fernando",ln:"Vial",job:"Commercial Coordinator",company:"Banco Randon",email:"fernando.vial@bancorandon.com",phone:"(54) 3239-4600",industry:"banking",linkedin:"http://www.linkedin.com/in/fernando-vial-2a3b13161",city:"Caxias do Sul"},
  {fn:"Silvio",ln:"Barreto",job:"CEO",company:"Financia Fidc",email:"silvio@financiafidc.com.br",phone:"(11) 4372-5339",industry:"financial services",linkedin:"http://www.linkedin.com/in/silvio-barreto-281245218",city:"Guarulhos"},
  {fn:"Eduardo",ln:"Galvao",job:"Sócio e Diretor Comercial",company:"AZ Guidance",email:"egalvao@guidance.com.br",phone:"(31) 991306667",industry:"investment management",linkedin:"http://www.linkedin.com/in/eduardo-a-c-galv%c3%a3o-60b3764b",city:"Rio de Janeiro"},
  {fn:"Victor",ln:"Martinez",job:"CEO",company:"Cambio Hoje",email:"victor@cambiohoje.com.br",phone:"(11) 2364-7979",industry:"financial services",linkedin:"http://www.linkedin.com/in/victor-martinez-714705314",city:"Boca Raton"},
  {fn:"Samir",ln:"Nahas",job:"CEO",company:"iTransfr",email:"samir@itransfr.com",phone:"(11) 98743-9999",industry:"financial services",linkedin:"http://www.linkedin.com/in/samir-al-nahas-996a5a37a",city:"Sao Paulo"},
  {fn:"Vinicius",ln:"Brittes",job:"CEO",company:"TX4 Capital",email:"vinicius@tx4capital.com.br",phone:"(51) 9727-1863",industry:"financial services",linkedin:"http://www.linkedin.com/in/vin%c3%adcius-brittes-a1a02436",city:""},
  {fn:"Frederico",ln:"Vasques",job:"CEO",company:"Creditise Fidc",email:"frederico.vasques@creditise.com.br",phone:"(11) 3176-5777",industry:"financial services",linkedin:"http://www.linkedin.com/in/frederico-vasques-6b02b578",city:"Sao Paulo"},
  {fn:"Michele",ln:"Campos",job:"Commercial Director",company:"Promotora CredForYou",email:"michele.campos@credforyou.com.br",phone:"(88) 2145-0903",industry:"financial services",linkedin:"http://www.linkedin.com/in/michele-campos-0989b1a2",city:"Rio de Janeiro"},
  {fn:"Raquel",ln:"Carmo",job:"Commercial Coordinator",company:"Transfeera",email:"raquel.carmo@transfeera.com",phone:"(47) 3512-0225",industry:"financial services",linkedin:"http://www.linkedin.com/in/raquel-carmo-166649152",city:""},
  {fn:"Leandro",ln:"Aquino",job:"Coordenador de TI",company:"Rumo Atuarial",email:"leandro@rodartenogueira.com.br",phone:"(31) 3346-0100",industry:"financial services",linkedin:"http://www.linkedin.com/in/leandro-aquino-88856694",city:"Sabara"},
  {fn:"Jesiel",ln:"Henrique",job:"CEO",company:"Unicopay",email:"jesiel@unicopay.com.br",phone:"(31) 98580-6662",industry:"financial services",linkedin:"http://www.linkedin.com/in/jesiel-henrique-94739b333",city:"Belo Horizonte"},
  {fn:"Zeyede",ln:"Tesfaye",job:"Chief Executive Officer",company:"INBOX",email:"zeyede@opensummit.com.br",phone:"(21) 996039433",industry:"financial services",linkedin:"http://www.linkedin.com/in/inbox-facility-ceo",city:""},
  {fn:"Carlos",ln:"Camargo",job:"CEO",company:"Maranhão Bank",email:"carlos.camargo@maranhaobank.com.br",phone:"(11) 4004-2979",industry:"financial services",linkedin:"http://www.linkedin.com/in/carlos-camargo-a552b81b",city:"Sao Luis"},
  {fn:"Bernardo",ln:"Maia",job:"CEO BRG Capital",company:"BRG Capital",email:"bernardo@brgcapital.com",phone:"(11) 3704-3450",industry:"financial services",linkedin:"http://www.linkedin.com/in/bernardo-maia-78058b191",city:"Sao Paulo"},
  {fn:"Joao",ln:"Freitas",job:"CEO",company:"Beeteller",email:"joao.freitas@beeteller.com",phone:"(67) 4042-3050",industry:"financial services",linkedin:"http://www.linkedin.com/in/jo%c3%a3ocampanelli",city:"Sao Paulo"},
  {fn:"Martin",ln:"Arranz",job:"Chief Executive Officer",company:"Banco Caixa Geral Brasil",email:"martin.cordeiro@bcgbrasil.com.br",phone:"(11) 3471-4200",industry:"banking",linkedin:"http://www.linkedin.com/in/arranzmartin",city:"Sao Paulo"},
  {fn:"Elisabeth",ln:"Moreira",job:"Commercial Coordinator",company:"COGEM COOPERATIVA DE CRÉDITO",email:"elisabeth.moreira@cogem.com.br",phone:"(11) 3080-4120",industry:"financial services",linkedin:"http://www.linkedin.com/in/elisabeth-a-s-moreira-53b22432",city:"Sorocaba"},
  {fn:"Gabriel",ln:"Laborao",job:"IT Supervisor",company:"Freex Câmbio",email:"gabriel.laborao@freexcambio.com.br",phone:"(11) 5108-5142",industry:"financial services",linkedin:"http://www.linkedin.com/in/gabriel-sales-laborao",city:"Sao Paulo"},
  {fn:"Marcelo",ln:"Xavier",job:"CEO",company:"Unicon Soluções de Crédito",email:"marcelo@uniconconsult.com",phone:"(11) 2227-1190",industry:"financial services",linkedin:"http://www.linkedin.com/in/marcelo-xavier-77608b200",city:"Sao Paulo"},
  {fn:"Emannuel",ln:"Maclaude",job:"CEO",company:"Maclaude",email:"emannuel@maclaude.com.br",phone:"(21) 3030-1766",industry:"capital markets",linkedin:"http://www.linkedin.com/in/emannuel-maclaude-19628638",city:"Rio de Janeiro"},
  {fn:"Eduardo",ln:"Deschamps",job:"IT Coordinator",company:"latinacobrancas.com.br",email:"eduardo.deschamps@latinacobrancas.com.br",phone:"(47) 3802-5600",industry:"financial services",linkedin:"http://www.linkedin.com/in/eduardo-deschamps-4526b9122",city:"Joinville"},
  {fn:"Kiko",ln:"Furtado",job:"CEO",company:"Acreditar FIDC",email:"kiko@acreditarfidc.com.br",phone:"(11) 4312-0264",industry:"banking",linkedin:"http://www.linkedin.com/in/kiko-furtado-9716987b",city:"Mogi das Cruzes"},
  {fn:"Karen",ln:"Borges",job:"Commercial Supervisor",company:"NIO Digital",email:"karen.borges@niodigital.com.br",phone:"(11) 99864-07292",industry:"financial services",linkedin:"http://www.linkedin.com/in/karen-borges-b0053b38",city:"Sao Paulo"},
  {fn:"Joel",ln:"Cancherini",job:"Diretor Comercial - Partners",company:"A7 Credit Securitizadora S/A",email:"joel.cancherini@a7credit.com.br",phone:"(19) 2042-1041",industry:"financial services",linkedin:"http://www.linkedin.com/in/joel-cancherini-b195a329",city:"Campinas"},
  {fn:"Marcelo",ln:"Oliveira",job:"Chief Revenue Officer (CRO)",company:"Culttivo",email:"marcelo@culttivo.com",phone:"(11) 3031-9523",industry:"financial services",linkedin:"http://www.linkedin.com/in/marcelo-oliveira-47416611",city:"Campinas"},
  {fn:"Eduardo",ln:"Sorensen",job:"CEO",company:"Credifit",email:"eduardo@credifit.com.br",phone:"(71) 3493-3974",industry:"financial services",linkedin:"http://www.linkedin.com/in/eduardo-sorensen",city:"Salvador"},
  {fn:"Marcell",ln:"Salgado",job:"CEO",company:"E-ctare",email:"marcell.salgado@ectare.com.br",phone:"(35) 99855-8125",industry:"financial services",linkedin:"http://www.linkedin.com/in/marcell-montip%c3%b3-salgado-b00653137",city:"Sao Sebastiao do Paraiso"},
  {fn:"Mauricio",ln:"Felippetti",job:"IT Coordinator",company:"Sinosserra Serviços Financeiros",email:"mauricio@sinosserrafinanceira.com.br",phone:"(51) 3910-1190",industry:"financial services",linkedin:"http://www.linkedin.com/in/mauricio-felippetti-1a015812",city:"Porto Alegre"},
  {fn:"Sergio",ln:"Oliveira",job:"CEO",company:"Pagcard",email:"sergioh@cartaopagcard.com.br",phone:"(62) 3941-9233",industry:"financial services",linkedin:"http://www.linkedin.com/in/sergio-oliveira-79a5541ba",city:"Goiania"},
  {fn:"Eduardo",ln:"Calafell",job:"IT Coordinator",company:"Intrabank",email:"eduardo.calafell@intrabank.com.br",phone:"(11) 4673-3300",industry:"financial services",linkedin:"http://www.linkedin.com/in/eduardo-calafell-508239100",city:"Sao Bernardo do Campo"},
  {fn:"Bruna",ln:"Merola",job:"CEO",company:"G3 Crédito Imobiliário",email:"bruna.merola@g3negocios.com.br",phone:"(62) 9 9439-6758",industry:"financial services",linkedin:"http://www.linkedin.com/in/bruna-m%c3%a9rola-5299b0b9",city:"Porto Alegre"},
  {fn:"Enil",ln:"Neto",job:"CEO",company:"Grow Investing",email:"enil.neto@growinvesting.com.br",phone:"(48) 99102-2889",industry:"financial services",linkedin:"http://www.linkedin.com/in/enil-neto-45666b171",city:"Goiania"},
  {fn:"Bru",ln:"Altieri",job:"Diretor de Marketing e Comunicação",company:"Conta Infinity",email:"bruno@containfinity.com.br",phone:"(11) 2368-3931",industry:"financial services",linkedin:"http://www.linkedin.com/in/bru-altieri",city:"Rio de Janeiro"},
  {fn:"Leonardo",ln:"Tessler",job:"Diretor Comercial & Produto",company:"AlyPlus",email:"leonardo.tessler@alyplus.com",phone:"(11) 97967-3017",industry:"financial services",linkedin:"http://www.linkedin.com/in/leonardo-tessler",city:"Sao Paulo"},
  {fn:"Joao",ln:"Fraga",job:"Chief Executive Officer",company:"Paag",email:"joao@paag.io",phone:"(31) 3123-0010",industry:"financial services",linkedin:"http://www.linkedin.com/in/jgfraga",city:"Belo Horizonte"},
  {fn:"Fabio",ln:"Drumond",job:"Diretor Comercial (CCO)",company:"MeuCashCard",email:"fabio@meucashcard.com.br",phone:"(11) 7083-8484",industry:"financial services",linkedin:"http://www.linkedin.com/in/f%c3%a1bio-drumond-44682327",city:"Sao Paulo"},
  {fn:"Artur",ln:"Pimentel",job:"IT Coordinator",company:"Menestys Group",email:"artur@menestys.com.br",phone:"(11) 95384-1000",industry:"investment banking",linkedin:"http://www.linkedin.com/in/artur-pimentel-a7817a38",city:"Sao Paulo"},
  {fn:"Wanessa",ln:"Nobre",job:"Commercial Director",company:"Grupo Thanks",email:"wanessa@grupothanks.com",phone:"(11) 4184-7199",industry:"financial services",linkedin:"http://www.linkedin.com/in/wanessa-nobre-390827357",city:"Fortaleza"},
  {fn:"Willians",ln:"Santana",job:"IT Supervisor",company:"Piemonte Holding",email:"wn@piemonteholding.com",phone:"(21) 3592-1221",industry:"financial services",linkedin:"http://www.linkedin.com/in/willians-santana-73686b153",city:"Rio de Janeiro"},
  {fn:"Debora",ln:"Matos",job:"CEO",company:"Finanz",email:"dmatos@finanzkredit.com.br",phone:"(11) 4395-3223",industry:"financial services",linkedin:"http://www.linkedin.com/in/debora-matos-84971399",city:"Barueri"},
  {fn:"Carlos",ln:"Goetz",job:"IT Coordinator",company:"PREVISC",email:"carlos@previsc.com.br",phone:"(48) 3181-0908",industry:"investment management",linkedin:"http://www.linkedin.com/in/carlos-goetz-41b06390",city:"Florianopolis"},
  {fn:"Carlos",ln:"Rodrigo",job:"IT Coordinator",company:"Sicoob JUS-MP",email:"carlos.souza@sicoobjusmp.com.br",phone:"(31) 98565-9572",industry:"financial services",linkedin:"http://www.linkedin.com/in/carlosrodrigo00",city:"Belo Horizonte"},
  {fn:"Michael",ln:"Lira",job:"Commercial Supervisor",company:"Integral Trust Serviços",email:"michael.lira@integraltrust.com.br",phone:"(11) 3103-2500",industry:"financial services",linkedin:"http://www.linkedin.com/in/michael-lira-a24b0956",city:"Vargem Grande Paulista"},
  {fn:"Thiago",ln:"Chiliatto",job:"CEO",company:"Antecipa Fácil",email:"thiago@antecipafacil.com.br",phone:"(19) 3500-6071",industry:"financial services",linkedin:"http://www.linkedin.com/in/thiago-critter-chiliatto-1613171",city:"Campinas"},
  {fn:"Gelson",ln:"",job:"CEO",company:"Parabank",email:"gelson@parabank.com.br",phone:"(11) 98350-7963",industry:"banking",linkedin:"http://www.linkedin.com/in/gelson-jr-55102a2ba",city:"Sao Bernardo do Campo"},
  {fn:"Rodrigo",ln:"Bego",job:"CEO",company:"Gobe Advisors",email:"diretoria@gobeadvisors.com.br",phone:"(11) 97238-7656",industry:"financial services",linkedin:"http://www.linkedin.com/in/rodrigo-bego-555494182",city:"Mogi das Cruzes"},
  {fn:"Jose",ln:"Alfradique",job:"Diretor Comercial | Partner",company:"IORQ",email:"jose.alfradique@iorq.com.br",phone:"(21) 99816-2103",industry:"investment management",linkedin:"http://www.linkedin.com/in/jos%c3%a9-luiz-alfradique-6a968157",city:"Sao Paulo"},
  {fn:"Hugo",ln:"Paraguassu",job:"IT Coordinator",company:"Sicoob Credicarpa",email:"hugo.paraguassu@sicoobcredicarpa.com.br",phone:"(34) 3852-0000",industry:"financial services",linkedin:"http://www.linkedin.com/in/hugo-almeida-paraguassu-2b7777123",city:"Patos de Minas"},
  {fn:"Izo",ln:"Junior",job:"Diretor de Marketing & UX",company:"Consórcios Digital",email:"izo@consorcios.digital",phone:"(61) 9640-9311",industry:"banking",linkedin:"http://www.linkedin.com/in/izojunior",city:"Campinas"},
  {fn:"Eder",ln:"Silva",job:"Proprietário e Diretor Comercial",company:"Foment",email:"eder@foment.com.br",phone:"(11) 95933-1783",industry:"investment management",linkedin:"http://www.linkedin.com/in/silvaeder",city:""},
  {fn:"Juari",ln:"Santos",job:"IT Coordinator",company:"Qore",email:"juari.santos@qoredtvm.com.br",phone:"(11) 3106-4767",industry:"investment management",linkedin:"http://www.linkedin.com/in/juarixavier",city:"Sao Paulo"},
  {fn:"Caio",ln:"Gelfi",job:"Co-founder e Diretor Comercial",company:"Vixtra",email:"caio.gelfi@vixtra.com",phone:"(11) 9 3620-8185",industry:"financial services",linkedin:"http://www.linkedin.com/in/caio-gelfi-86521b26",city:"Sao Paulo"},
  {fn:"Iarley",ln:"Melo",job:"IT Coordinator",company:"Sicoob Credivale Oficial",email:"iarley.melo@sicoobcredivale.com.br",phone:"(48) 3658-2762",industry:"financial services",linkedin:"http://www.linkedin.com/in/iarley-da-cunha-melo-28035a32",city:"Teofilo Otoni"},
  {fn:"Vinicius",ln:"Crizel",job:"IT Director",company:"Marco Investimentos",email:"vinicius.crizel@marcoinvestimentos.com.br",phone:"(11) 4935-2720",industry:"financial services",linkedin:"http://www.linkedin.com/in/viniciuscrizel",city:"Joinville"},
  {fn:"Rafael",ln:"Bento",job:"CEO",company:"DMX Capital S.A",email:"rafael.bento@dmxcapital.com.br",phone:"(32) 99922-0807",industry:"financial services",linkedin:"http://www.linkedin.com/in/rafael-bento-777099242",city:"Uba"},
  {fn:"Marcel",ln:"Baumgartner",job:"Partner and CEO",company:"Euromaxx",email:"marcel@euromaxx.com.br",phone:"(11) 3073 1422",industry:"financial services",linkedin:"http://www.linkedin.com/in/marcel-baumgartner-b6787a9b",city:"Sao Paulo"},
  {fn:"Wagner",ln:"Moraes",job:"Chief Executive Officer",company:"A&S Partners",email:"wagner.moraes@aespartners.com.br",phone:"(11) 4949-9518",industry:"financial services",linkedin:"http://www.linkedin.com/in/wagnermoraes",city:"Sao Paulo"},
  {fn:"Gabriel",ln:"Souza",job:"Chief Executive Officer",company:"Claw Express",email:"gabriel@clawexpress.com.br",phone:"(48) 3054-4121",industry:"financial services",linkedin:"http://www.linkedin.com/in/gabrieldesouza92",city:"Sao Jose"},
  {fn:"Nilton",ln:"Brancaleao",job:"Diretor Comercial",company:"Grupo B4",email:"nilton.brancaleao@creditpartners.com.br",phone:"(19) 3751-4300",industry:"financial services",linkedin:"http://www.linkedin.com/in/nilton-cesar-brancaleao-753b3026",city:""},
  {fn:"Imar",ln:"Ecco",job:"Commercial Director",company:"Cclaa Itaipu - Sicoob Creditaipu",email:"imar@creditaipu.com.br",phone:"(48) 3261-9000",industry:"financial services",linkedin:"http://www.linkedin.com/in/imar-roque-ecco-64945b60",city:"Pinhalzinho"},
  {fn:"Diego",ln:"Botelho",job:"CEO",company:"Cia G3",email:"diego.botelho@ciag3.com",phone:"(62) 98249-7164",industry:"financial services",linkedin:"http://www.linkedin.com/in/diego-botelho-0191b3302",city:""},
  {fn:"Andre",ln:"Bernardes",job:"CEO",company:"Zippi",email:"andre@zippi.com.br",phone:"(11) 9 5667-8227",industry:"financial services",linkedin:"http://www.linkedin.com/in/andre-bernardes",city:"Sao Paulo"},
  {fn:"Camila",ln:"Rodrigues",job:"Commercial Coordinator",company:"Banco Psa Finance Brasil",email:"camila.rodrigues1@stellantis.com",phone:"(11) 3003-9755",industry:"banking",linkedin:"http://www.linkedin.com/in/camila-rodrigues-49398831",city:"Belo Horizonte"},
  {fn:"Thales",ln:"Arthur",job:"IT Coordinator",company:"Sicoob Emprecred",email:"thales.miranda@sicoobemprecred.com.br",phone:"(62) 3353-3303",industry:"financial services",linkedin:"http://www.linkedin.com/in/thales-arthur-93575479",city:"Goianesia"},
  {fn:"Caio",ln:"Piomonte",job:"CEO",company:"YpControl",email:"caiopiomonte@egen.com.br",phone:"(83) 99115-6364",industry:"financial services",linkedin:"http://www.linkedin.com/in/caiopiomonte",city:""},
  {fn:"Janio",ln:"Zeferino",job:"Chief Executive Officer",company:"AgroEasy",email:"janio@agroeasy.com.br",phone:"(61) 3970-2087",industry:"financial services",linkedin:"http://www.linkedin.com/in/janio-zeferino-89149070",city:"Brasilia"},
  {fn:"Wanderlei",ln:"Silva",job:"IT Coordinator",company:"CQUATRO",email:"wanderlei.silva@cquatro.com.br",phone:"(11) 3292-6355",industry:"financial services",linkedin:"http://www.linkedin.com/in/wanderlei-rodrigues-silva-85621a61",city:"Mogi das Cruzes"},
  {fn:"Bruno",ln:"Souza",job:"IT Coordinator",company:"Sicoob Médio Oeste",email:"bruno.r.souza@sicoob.com.br",phone:"(44) 3528-0900",industry:"financial services",linkedin:"http://www.linkedin.com/in/brunorodsouza",city:"Rio de Janeiro"},
  {fn:"Simone",ln:"Carvalho",job:"Commercial Supervisor",company:"entrounaconta",email:"simone@entrounaconta.com",phone:"(11) 3090-0456",industry:"financial services",linkedin:"http://www.linkedin.com/in/simone-carvalho-9b638320b",city:"Rio Claro"},
  {fn:"Alexandre",ln:"Kanaan",job:"Diretor Comercial e de Marketing",company:"Keeper",email:"alexandre.kanaan@keeperformaturas.com.br",phone:"(32) 99128-3680",industry:"financial services",linkedin:"http://www.linkedin.com/in/alexandre-kanaan-87561212a",city:"Sao Paulo"},
  {fn:"Marcelo",ln:"Franciscon",job:"CEO",company:"Solution For Life",email:"mfranciscon@solutionforlife.com.br",phone:"(11) 94724-9592",industry:"financial services",linkedin:"http://www.linkedin.com/in/marcelo-franciscon-6b516313",city:""},
  {fn:"Diego",ln:"Vilar",job:"IT Coordinator",company:"Zignet",email:"diego.vilar@zignet.com.br",phone:"(11) 5171-8474",industry:"financial services",linkedin:"http://www.linkedin.com/in/diego-pantale%c3%a3o-vilar",city:"Guarulhos"},
  {fn:"Leonardo",ln:"Trevisan",job:"IT Coordinator",company:"Banco BRP",email:"leonardo@brp.com.br",phone:"(16) 2101-4600",industry:"banking",linkedin:"http://www.linkedin.com/in/leonardo-trevisan-62537418b",city:"Sertaozinho"},
  {fn:"Douglas",ln:"Rosa",job:"Diretor Comercial e Sócio",company:"TRAAD",email:"douglas.rosa@traad.com.br",phone:"(11) 5555-2015",industry:"financial services",linkedin:"http://www.linkedin.com/in/douglas-rosa-6278b4165",city:"Sao Paulo"},
  {fn:"Manuel",ln:"Junior",job:"CEO",company:"Muito",email:"junior@muito.io",phone:"(75) 99930-0030",industry:"financial services",linkedin:"http://www.linkedin.com/in/manuel-j%c3%banior-5050ba41",city:"Feira de Santana"},
  {fn:"Ronaldo",ln:"Askar",job:"Diretor Comercial Life365",company:"life365",email:"ronaldo.askar@life365.com.br",phone:"(31) 99432-1039",industry:"financial services",linkedin:"http://www.linkedin.com/in/ronaldoaskarjr",city:"Belo Horizonte"},
  {fn:"Pedro",ln:"Ribeiro",job:"Sócio-Diretor Comercial",company:"Connex Capital",email:"pedro.ribeiro@connexcapital.com.br",phone:"(11) 5464-1590",industry:"investment management",linkedin:"http://www.linkedin.com/in/pedro-folli-ribeiro-553a8b159",city:"Campinas"},
  {fn:"Paulo",ln:"Henrique",job:"CEO",company:"Iriom",email:"paulo.nascimento@iriom.com.br",phone:"(17) 98118-8605",industry:"financial services",linkedin:"http://www.linkedin.com/in/paulounion",city:""},
  {fn:"Julio",ln:"Ribeiro",job:"Coordenador Comercial e Middle",company:"Acura Capital",email:"julio.ribeiro@acuracapital.com.br",phone:"(11) 4210-1961",industry:"financial services",linkedin:"http://www.linkedin.com/in/j%c3%balio-c%c3%a9sar-mota-afonso-ribeiro-50429421",city:"Sao Paulo"},
  {fn:"Herison",ln:"Bessa",job:"CEO",company:"FinanBank",email:"herison@finanbankbr.com.br",phone:"(11) 94731-7333",industry:"financial services",linkedin:"http://www.linkedin.com/in/herison-bessa-6949b31a5",city:"Fortaleza"},
  {fn:"Vitor",ln:"Tripodi",job:"Diretor Comercial e Produtos",company:"Dinamo Promotora de Crédito",email:"vitor.tripodi@dinamopromotora.com.br",phone:"(11) 5042-2405",industry:"financial services",linkedin:"http://www.linkedin.com/in/vitor-tripodi-821a28a",city:"Sao Paulo"},
  {fn:"Luciano",ln:"Pereira",job:"CEO",company:"Capital Brazil",email:"luciano@capitalbrazil.com.br",phone:"(35) 3221-6774",industry:"financial services",linkedin:"http://www.linkedin.com/in/luciano-resende-pereira-3aa30145",city:"Varginha"},
  {fn:"Junior",ln:"Oseas",job:"IT Coordinator",company:"Sicoob Acicredi",email:"oseas@acicredi.com.br",phone:"(61) 4000 1111",industry:"financial services",linkedin:"http://www.linkedin.com/in/j%c3%banior-os%c3%a9as-578b5457",city:"Guaxupe"},
  {fn:"Nilson",ln:"Strazzi",job:"CEO",company:"Latam Access Finance",email:"nstrazzi@latam-access.com",phone:"(11) 2655-1848",industry:"financial services",linkedin:"http://www.linkedin.com/in/nilson-strazzi-903798b",city:"Sao Paulo"},
  {fn:"Dione",ln:"Mello",job:"Fundador | Diretor Comercial",company:"Qoros Capital",email:"dione.mello@qoroscapital.com.br",phone:"(11) 98366-3126",industry:"financial services",linkedin:"http://www.linkedin.com/in/dione-mello",city:"Sao Paulo"},
  {fn:"Ricardo",ln:"Lazzari",job:"CEO",company:"Evoque Securitizadora S.A.",email:"ricardo@evoque.com.br",phone:"(51) 3377-8750",industry:"financial services",linkedin:"http://www.linkedin.com/in/ricardo-lazzari-8222122b",city:"Porto Alegre"},
  {fn:"Savio",ln:"Barros",job:"CEO",company:"Sten Multi-Family Office",email:"savio.barros@sten.capital",phone:"(11) 98262-6888",industry:"investment management",linkedin:"http://www.linkedin.com/in/s%c3%a1vio-barros-b8315b9b",city:"Sao Paulo"},
  {fn:"Juliano",ln:"Frausino",job:"CEO",company:"Goiás Bank",email:"juliano.frausino@goiasbank.com",phone:"(11) 4003-7677",industry:"banking",linkedin:"http://www.linkedin.com/in/julianofrausino",city:"Goiania"},
  {fn:"Diego",ln:"Vogado",job:"Sócio Proprietário - Diretor Comercial",company:"Fieza Consórcios",email:"diegovogado@fiezaconsorcios.com",phone:"(12) 99164-9222",industry:"financial services",linkedin:"http://www.linkedin.com/in/diego-vogado-10507b205",city:"Taubate"},
  {fn:"Ana",ln:"Almeida",job:"CEO",company:"SEMPRE REAL",email:"ana@semprereal.com",phone:"(48) 99191-0234",industry:"financial services",linkedin:"http://www.linkedin.com/in/ana-carla-almeida-21ab5b290",city:"Tubarao"},
  {fn:"Marcelo",ln:"Biavatti",job:"Coordenador Comercial Nacional",company:"Banco Moneo",email:"marcelo.biavatti@bancomoneo.com.br",phone:"(54) 2991-1021",industry:"financial services",linkedin:"http://www.linkedin.com/in/marcelo-biavatti-80046a56",city:"Curitiba"},
  {fn:"Leandro",ln:"Giacomini",job:"CEO",company:"Legacy Bank",email:"leandro@legaci.com.br",phone:"(65) 99996-8782",industry:"financial services",linkedin:"http://www.linkedin.com/in/leandro-giacomini",city:"Sinop"},
  {fn:"Sergio",ln:"Melato",job:"Commercial Supervisor",company:"GazinBank",email:"sergio.melato@gazin.com.br",phone:"(44) 8848-8282",industry:"banking",linkedin:"http://www.linkedin.com/in/sergio-melato-011821137",city:"Ivate"},
  {fn:"Ikaro",ln:"Neves",job:"CEO",company:"Fintera",email:"ikaro.neves@fintera.com.br",phone:"(21) 3520-5250",industry:"financial services",linkedin:"http://www.linkedin.com/in/ikaroneves",city:"Barueri"},
  {fn:"Raul",ln:"Ulup",job:"CEO",company:"Jobin Investimentos",email:"raul.shalders@jobininvestimentos.com.br",phone:"(11) 2391-9160",industry:"financial services",linkedin:"http://www.linkedin.com/in/raul-shalders-ulup-cfp%c2%ae-20013124",city:"Rio de Janeiro"},
  {fn:"Felipe",ln:"Bueno",job:"CEO",company:"Sigur Group",email:"fbueno@bxcapital.com",phone:"(11) 6660 9934",industry:"financial services",linkedin:"http://www.linkedin.com/in/felipe-bueno-7b5b10b5",city:"Rio de Janeiro"},
  {fn:"Danillo",ln:"Oliveira",job:"CEO",company:"ANGATU Private",email:"danillo.oliveira@angatuprivate.com.br",phone:"(11) 3083-0567",industry:"financial services",linkedin:"http://www.linkedin.com/in/danillo-oliveira-62a4b633",city:"Sao Paulo"},
  {fn:"Rafael",ln:"Alessi",job:"CEO",company:"AL5 AMAGGI",email:"rafael.alessi@al5bank.com.br",phone:"(65) 99214-9086",industry:"banking",linkedin:"http://www.linkedin.com/in/rafael-alessi-ab92b0141",city:""},
  {fn:"Victor",ln:"Gouveia",job:"Commercial Director",company:"Squad Capital Investimentos",email:"victor.gouveia@squadcapital.com.br",phone:"(11) 3078-4634",industry:"financial services",linkedin:"http://www.linkedin.com/in/victor-hugo-gouveia-cfp%c2%ae-722133b4",city:"Sao Paulo"},
  {fn:"Leonardo",ln:"Cavalcante",job:"CEO",company:"Grupo Fractal",email:"lcavalcante@fractalinvestimentos.com.br",phone:"(37) 3071-1515",industry:"financial services",linkedin:"http://www.linkedin.com/in/leonardo-cavalcante-00aa7a20b",city:"Divinopolis"},
  {fn:"Rafael",ln:"Pacheco",job:"CEO",company:"HCI Advisors",email:"rafael.pacheco@hciadvisors.com.br",phone:"(11) 4861-2440",industry:"financial services",linkedin:"http://www.linkedin.com/in/rafael-pacheco-hci",city:"Sao Paulo"},
  {fn:"Elaine",ln:"Witkoski",job:"CEO",company:"Aros Negócios",email:"elaine@arosnegocios.com",phone:"(48) 3024-8077",industry:"financial services",linkedin:"http://www.linkedin.com/in/elaine-fernanda-witkoski-a68195171",city:""},
  {fn:"Eduardo",ln:"Rossi",job:"CEO",company:"ABRIR",email:"eduardo@abrir.org.br",phone:"(11) 95259-6360",industry:"financial services",linkedin:"http://www.linkedin.com/in/eduardo-rossi-396984b",city:"Sao Paulo"},
  {fn:"Leticia",ln:"Caroline",job:"Commercial Coordinator",company:"Linea Promotora",email:"leticia@lineapromotora.com.br",phone:"(41) 3077-4224",industry:"financial services",linkedin:"http://www.linkedin.com/in/let%c3%adcia-caroline-1a6802199",city:"Curitiba"},
  {fn:"Leonardo",ln:"Simoes",job:"CEO",company:"MSX Invest",email:"leonardo.simoes@msxinvest.com.br",phone:"(11) 95372-0655",industry:"financial services",linkedin:"http://www.linkedin.com/in/leonardo-k-simoes",city:"Rio de Janeiro"},
  {fn:"Roberto",ln:"Rabelo",job:"IT Director",company:"BScash",email:"roberto.rabelo@bscash.com.br",phone:"(85) 98805-5092",industry:"financial services",linkedin:"http://www.linkedin.com/in/roberto-rabelo-a3b705b",city:"Fortaleza"},
  {fn:"Saulo",ln:"Tristao",job:"Chief Executive Officer",company:"Facio",email:"saulo@facio.com",phone:"(11) 4040-5513",industry:"financial services",linkedin:"http://www.linkedin.com/in/saulo-tristao-053635371",city:"Sao Paulo"},
  {fn:"Ricardo",ln:"Mendes",job:"CEO",company:"HBI",email:"ricardo@somoshbi.com.br",phone:"(32) 98848-0002",industry:"financial services",linkedin:"http://www.linkedin.com/in/ricardo-barros-mendes-622989191",city:"Leopoldina"},
  {fn:"Mauro",ln:"Ricardo",job:"Diretor de Marketing Sênior",company:"Jequitibá Investimentos",email:"mauro@jequitibainvestimentos.com.br",phone:"(11) 4837-5658",industry:"investment banking",linkedin:"http://www.linkedin.com/in/mauro-ricardo-94105919",city:"Sao Paulo"},
  {fn:"Heitor",ln:"Meneguette",job:"CEO",company:"Unavanti",email:"heitor@unavanti.com.br",phone:"(44) 3027-2930",industry:"banking",linkedin:"http://www.linkedin.com/in/heitor-meneguette-08b824218",city:"Maringa"},
  {fn:"Leandro",ln:"Machado",job:"Diretor Comercial e Agronegócios",company:"Ifinc",email:"leandro@ifinc.com.br",phone:"(11) 94035-1895",industry:"financial services",linkedin:"http://www.linkedin.com/in/leandro-machado-278aa223",city:"Sao Paulo"},
  {fn:"Bruno",ln:"Redin",job:"CEO",company:"Big Capital",email:"bruno.redin@bigcapital.com.br",phone:"(11) 97648-1920",industry:"financial services",linkedin:"http://www.linkedin.com/in/bruno-redin-3aa76b13a",city:"Porto Alegre"},
  {fn:"Thaissa",ln:"Braz",job:"CEO",company:"Astra Capital",email:"thaissa@astracapital.com.br",phone:"(11) 94311-8430",industry:"financial services",linkedin:"http://www.linkedin.com/in/thaissa-braz-private-banking",city:"Sao Paulo"},
  {fn:"Paulo",ln:"Araujo",job:"CEO",company:"Banco Mercantil de Investimentos",email:"paulo.araujo@bancobmi.com.br",phone:"(31) 3057-5977",industry:"investment banking",linkedin:"http://www.linkedin.com/in/paulo-henrique-araujo-8135aa1a0",city:"Belo Horizonte"},
  {fn:"Victor",ln:"Hugo",job:"Coordenador de TI Pleno",company:"Mobi FIDC",email:"victor.hugo@mobibanco.com.br",phone:"(21) 2277-7450",industry:"financial services",linkedin:"http://www.linkedin.com/in/victor-hugo-8785451b9",city:"Porto"},
  {fn:"Jefferson",ln:"Plentz",job:"CEO",company:"Bromelia Capital",email:"jeff.plentz@techtools.vc",phone:"(14) 3351-1600",industry:"financial services",linkedin:"http://www.linkedin.com/in/jplentz",city:"Sao Paulo"},
  {fn:"Hebert",ln:"Leandro",job:"CEO",company:"High Limits Solutions",email:"hebert.leandro@hlfinanceira.com.br",phone:"(11) 97154-5670",industry:"financial services",linkedin:"http://www.linkedin.com/in/hebert-leandro-b8557946",city:"Osasco"},
  {fn:"Valter",ln:"Prado",job:"IT Supervisor",company:"STARA Financeira",email:"valter.prado@starafinanceira.com.br",phone:"(54) 3332 2800",industry:"financial services",linkedin:"http://www.linkedin.com/in/valter-do-prado-j%c3%banior-8822ab19a",city:"Carazinho"},
  {fn:"Charles",ln:"Uhlmann",job:"CEO",company:"Quero Financiar",email:"charles@querofinanciar.com",phone:"(47) 3091-0327",industry:"financial services",linkedin:"http://www.linkedin.com/in/charles-uhlmann",city:"Balneario Camboriu"},
  {fn:"Junior",ln:"Orosco",job:"CEO",company:"Fortune Group S.A",email:"junior.orosco@fortunegroup.com.br",phone:"(11) 99805-2212",industry:"environmental services",linkedin:"http://www.linkedin.com/in/junior-orosco-695210102",city:"Sao Paulo"},
  {fn:"Cristiano",ln:"Marinho",job:"Sócio e Diretor Comercial",company:"citybens negócios",email:"cristianomarinho@citybens.com.br",phone:"(18) 2102-1111",industry:"financial services",linkedin:"http://www.linkedin.com/in/cristiano-marinho-3227b0213",city:"Aracatuba"},
  {fn:"Allan",ln:"Ramos",job:"IT Coordinator",company:"Sicoob Centro-Oeste Br",email:"allan.ramos@sicoob.com.br",phone:"(41) 3180-0676",industry:"financial services",linkedin:"http://www.linkedin.com/in/allanramos91",city:"Goiania"},
  {fn:"Marcus",ln:"Ayres",job:"CEO & Senior Partner",company:"Sensa Partners",email:"marcus.ayres@sensapartners.com",phone:"(11) 94533-5230",industry:"investment banking",linkedin:"http://www.linkedin.com/in/marcusayres",city:"Sao Paulo"},
  {fn:"Juliana",ln:"Senna",job:"Commercial Coordinator",company:"Kardbank",email:"julianasenna@kardbank.com.br",phone:"(11) 97214-1209",industry:"financial services",linkedin:"http://www.linkedin.com/in/juliana-senna-a02305145",city:"Barueri"},
  {fn:"Othavio",ln:"Parisi",job:"Diretor Comercial e de Marketing",company:"CRDC",email:"oparisi@crdc.com.br",phone:"(11) 2892-5874",industry:"financial services",linkedin:"http://www.linkedin.com/in/othavio",city:"Sao Paulo"},
  {fn:"Matheus",ln:"Almeida",job:"Coordenador de Marketing e Comunicação",company:"Sicoob Credivale Oficial",email:"matheus.almeida@sicoobcredivale.com.br",phone:"(61) 4000 1111",industry:"financial services",linkedin:"http://www.linkedin.com/in/matheus-almeida-5a903917b",city:"Teofilo Otoni"},
  {fn:"Frederico",ln:"Neves",job:"CEO",company:"Atom Capital",email:"frederico.neves@atom.capital",phone:"(11) 4858-2509",industry:"banking",linkedin:"http://www.linkedin.com/in/frederico-neves-983298216",city:"Sao Paulo"},
  {fn:"Eduardo",ln:"Perdigao",job:"CEO",company:"EPIX capital",email:"perdigao@epixcapital.com.br",phone:"(11) 91199-4191",industry:"financial services",linkedin:"http://www.linkedin.com/in/eduardo-perdig%c3%a3o-144b487",city:"Sao Paulo"},
  {fn:"Enio",ln:"Shishido",job:"Diretor Comercial - Agronegócio",company:"Fator ORE",email:"eshishido@fator.com.br",phone:"(11) 4750-9868",industry:"investment management",linkedin:"http://www.linkedin.com/in/enio-shishido-71a16526",city:"Sao Paulo"},
  {fn:"Rafaela",ln:"Mota",job:"CEO",company:"BScash",email:"rafaela.mota@bscash.com.br",phone:"(85) 99619-1084",industry:"financial services",linkedin:"http://www.linkedin.com/in/rafaelamotaof",city:""},
  {fn:"Laercio",ln:"Silva",job:"Commercial Director",company:"Conta Infinity",email:"laercio.silva@containfinity.com.br",phone:"(11) 2368-3931",industry:"financial services",linkedin:"http://www.linkedin.com/in/laercioffsilva",city:"Sao Paulo"},
  {fn:"Fabricio",ln:"Rodrigues",job:"Commercial Director",company:"Finanzas Securitizadora",email:"fabriciopirovani@finanzasbank.com.br",phone:"(11) 93061-2754",industry:"financial services",linkedin:"http://www.linkedin.com/in/fabricio-pirovani-rodrigues-b1240227b",city:"Cachoeiro de Itapemirim"},
  {fn:"Almir",ln:"Filho",job:"CEO",company:"Supernova Energia",email:"almir@supernovaenergia.com",phone:"(41) 3073-9949",industry:"financial services",linkedin:"http://www.linkedin.com/in/almir-parigot-de-souza-filho-9b969590",city:"Curitiba"},
  {fn:"Dima",ln:"Rukin",job:"Chief Executive Officer",company:"LaFinteca",email:"rd@la-finteca.com",phone:"(11) 97099-1744",industry:"financial services",linkedin:"http://www.linkedin.com/in/dima-rukin-453458169",city:"Barcelona"},
  {fn:"Juarez",ln:"Seleme",job:"Partner & CEO",company:"Plancorp Capital",email:"j.seleme@plancorp.com.br",phone:"(41) 3339-3195",industry:"investment banking",linkedin:"http://www.linkedin.com/in/juarezseleme",city:"Curitiba"},
  {fn:"Lucas",ln:"Rezende",job:"Coordenador Comercial B2B",company:"AgroForte Agfintech",email:"lucas.rezende@meuagroforte.com.br",phone:"(41) 99217-6821",industry:"financial services",linkedin:"http://www.linkedin.com/in/lucas-rezende-lp",city:"Lagoa da Prata"},
  {fn:"Tassius",ln:"Motta",job:"CEO",company:"Open365",email:"tassius.motta@open365.com.br",phone:"(17) 98111-8114",industry:"financial services",linkedin:"http://www.linkedin.com/in/tassius-motta-cea%c2%ae-b0a819110",city:"Sao Paulo"},
  {fn:"Renata",ln:"Hofmeister",job:"Commercial Coordinator",company:"Banco Randon",email:"renata.hofmeister@bancorandon.com",phone:"(54) 3239-4600",industry:"banking",linkedin:"http://www.linkedin.com/in/renata-hofmeister-885704125",city:"Caxias do Sul"},
  {fn:"Lucas",ln:"Matos",job:"Coordenador de TI & Projetos",company:"LOARA Crédito",email:"lucas.matos@loara.com.br",phone:"(11) 94746-5908",industry:"financial services",linkedin:"http://www.linkedin.com/in/lucas-matos-212527208",city:"Diadema"},
  {fn:"Rodrigo",ln:"Torres",job:"Cofundador - Diretor Comercial e Operações",company:"TudoNoBolso",email:"rodrigo.torres@tudonobolso.com.br",phone:"(11) 4000-2976",industry:"financial services",linkedin:"http://www.linkedin.com/in/rodrigo-torres-82201460",city:"Sao Paulo"},
  {fn:"Leonardo",ln:"Grapeia",job:"CEO",company:"Qista",email:"leonardo.grapeia@souqista.com.br",phone:"(11) 3557-9300",industry:"financial services",linkedin:"http://www.linkedin.com/in/leonardograpeia",city:"Barueri"},
  {fn:"Iago",ln:"Valle",job:"Commercial Supervisor",company:"Flamex",email:"iago.valle@flamexnet.com.br",phone:"(41) 3071-5900",industry:"financial services",linkedin:"http://www.linkedin.com/in/iago-valle-5a05b3198",city:"Londrina"},
  {fn:"Valber",ln:"Melo",job:"Commercial Coordinator",company:"Rede Uze",email:"valber.melo@redeuze.com.br",phone:"(71) 99631-9755",industry:"financial services",linkedin:"http://www.linkedin.com/in/valber-melo-5a336b325",city:"Fortaleza"},
  {fn:"Eleandro",ln:"Rizzon",job:"CEO",company:"Squid Conta",email:"eleandro@gruposquid.com.br",phone:"(54) 99154-9661",industry:"financial services",linkedin:"http://www.linkedin.com/in/eleandrorizzon",city:"Caxias do Sul"},
  {fn:"Mayanderson",ln:"Lage",job:"CEO",company:"Banco Digital uPaybank",email:"mayanderson@maybank.com.br",phone:"(11) 94726-3029",industry:"banking",linkedin:"http://www.linkedin.com/in/mayanderson-lage",city:"Sao Paulo"},
  {fn:"Fabio",ln:"Cardoso",job:"Commercial Director",company:"Shield Bank",email:"fabio.cardoso@shieldbank.com.br",phone:"(11) 97665-7788",industry:"banking",linkedin:"http://www.linkedin.com/in/fabio-cardoso-3bb0a7130",city:"Sao Paulo"},
  {fn:"Alan",ln:"Gandelman",job:"Chief Executive Officer",company:"Sefer Investimentos",email:"alan.gandelman@seferinvestimentos.com.br",phone:"(11) 3113-0060",industry:"financial services",linkedin:"http://www.linkedin.com/in/alan-gandelman-415ab8217",city:"Sao Paulo"},
  {fn:"Euclides",ln:"Pinto",job:"Chief Executive Officer",company:"Unicon Soluções de Crédito",email:"euclides@uniconconsult.com",phone:"(11) 98146-0303",industry:"financial services",linkedin:"http://www.linkedin.com/in/euclides-pinto-40a73868",city:"Sao Paulo"},
  {fn:"Lilian",ln:"Santos",job:"Commercial Coordinator",company:"Truck Digital",email:"lilian.santos@truckdigital.com.br",phone:"(81) 99268-9225",industry:"financial services",linkedin:"http://www.linkedin.com/in/lilian-karoline-b-santos-624b3770",city:"Conroe"},
  {fn:"Eduardo",ln:"Rabelo",job:"IT Director",company:"Primo Capital",email:"eduardo@primocapital.com.br",phone:"(81) 4007-2080",industry:"financial services",linkedin:"http://www.linkedin.com/in/eduardo-rabelo-ba5b8048",city:"Recife"},
  {fn:"Fernando",ln:"Iodice",job:"Chief Executive Officer",company:"Consumidor Positivo",email:"fernando.iodice@consumidorpositivo.com.br",phone:"(11) 99517-3322",industry:"financial services",linkedin:"http://www.linkedin.com/in/fernandoiodice",city:"Sao Paulo"},
  {fn:"Cecilia",ln:"Almeida",job:"Coordenador Comercial em Precatórios",company:"Precatório Fácil",email:"cecilia.almeida@precatoriofacil.com.br",phone:"(11) 5242-8301",industry:"financial services",linkedin:"http://www.linkedin.com/in/cecilia-dos-santos-almeida-9676a51b8",city:"Sao Paulo"},
  {fn:"Daniel",ln:"Goldfinger",job:"Cofounder and CEO",company:"Kikkin | Fintech",email:"daniel.goldfinger@kikkin.com.br",phone:"(11) 2366-0816",industry:"financial services",linkedin:"http://www.linkedin.com/in/danielwgoldfinger",city:"Sao Paulo"},
  {fn:"Vicente",ln:"Neto",job:"CEO",company:"Mittu",email:"vicente.neto@mittubank.com.br",phone:"(85) 98820-1006",industry:"financial services",linkedin:"http://www.linkedin.com/in/vicente-araujo-neto-3a4b43114",city:"Fortaleza"},
  {fn:"Andre",ln:"Mozas",job:"Coordenador de TI e Mineração",company:"BR Experts",email:"andre.mozas@brefforts.com",phone:"(11) 99245-4247",industry:"financial services",linkedin:"http://www.linkedin.com/in/andr%c3%a9-mozas-001b10206",city:"Sao Paulo"},
  {fn:"Rodrigo",ln:"Campos",job:"IT Coordinator",company:"Banco BRP",email:"rcampos@brp.com.br",phone:"(16) 2101-4600",industry:"banking",linkedin:"http://www.linkedin.com/in/rodrigo-mota-campos-45b2b7276",city:"Ribeirao Preto"},
  {fn:"Jessica",ln:"Leivas",job:"Commercial Coordinator",company:"Renova Invest",email:"jessica.leivas@renovainvest.com.br",phone:"(11) 3192-3882",industry:"financial services",linkedin:"http://www.linkedin.com/in/j%c3%a9ssica-fernanda-leivas-534941119",city:"Sao Paulo"},
  {fn:"Ferdinando",ln:"Angeletti",job:"Chief Executive Officer",company:"Intesa Sanpaolo Brasil",email:"angeletti@intesasanpaolobrasil.com.br",phone:"(11) 3465-3700",industry:"banking",linkedin:"http://www.linkedin.com/in/ferdinando-angeletti-90809095",city:"Sao Paulo"},
  {fn:"Edrey",ln:"Pierre",job:"CEO",company:"Neela",email:"epierre@neela.com.br",phone:"(11) 99314-1922",industry:"financial services",linkedin:"http://www.linkedin.com/in/edrey-pierre-tep%c2%ae-a0231940",city:"Sao Paulo"},
  {fn:"Igor",ln:"Nishimura",job:"Founding CEO",company:"PoM WM",email:"igor.nishimura@pomwm.com",phone:"(11) 95656-0488",industry:"financial services",linkedin:"http://www.linkedin.com/in/igornishimura",city:"Sao Paulo"},
  {fn:"Thomas",ln:"Yuri",job:"Coordenador Comercial B2B",company:"Incentivale",email:"thomas@incentivale.com.br",phone:"(11) 2424-7265",industry:"financial services",linkedin:"http://www.linkedin.com/in/thomasyol",city:"Sao Paulo"},
  {fn:"Bruno",ln:"Dias",job:"CEO",company:"Higher Global",email:"bruno.riscado@higherglobal.com.br",phone:"(12) 3931-3511",industry:"financial services",linkedin:"http://www.linkedin.com/in/brunodiasadministrador",city:"Sao Paulo"},
  {fn:"Maria",ln:"Lima",job:"Commercial Coordinator",company:"Banco Psa Finance Brasil",email:"maria.lima@stellantis.com",phone:"(11) 3003-9755",industry:"banking",linkedin:"http://www.linkedin.com/in/maria-lima-a9bbb5179",city:""},
  {fn:"Arion",ln:"Tavora",job:"Commercial Director",company:"iHold Banking",email:"arion.tavora@iholdbank.digital",phone:"(47) 99264-1512",industry:"financial services",linkedin:"http://www.linkedin.com/in/arion-t%c3%a1vora-b711271a5",city:"Florianopolis"},
  {fn:"Renato",ln:"Almeida",job:"IT Coordinator",company:"Golden Cash",email:"gc.tecnologia@goldencash.com.br",phone:"(11) 99506-3845",industry:"financial services",linkedin:"http://www.linkedin.com/in/renato-mareque",city:"Sao Paulo"},
  {fn:"Marcelo",ln:"Seraphim",job:"Commercial Director",company:"STARK BANK",email:"marcelo.seraphim@starkbank.com",phone:"(11) 4116-4616",industry:"banking",linkedin:"http://www.linkedin.com/in/marcelo-seraphim-415b933",city:"Sao Paulo"},
  {fn:"Fabiano",ln:"Degraf",job:"CEO",company:"Campos Gerais Assessoria",email:"fabiano@cginvest.com.br",phone:"(42) 2702-0080",industry:"financial services",linkedin:"http://www.linkedin.com/in/fabiano-degraf-b12b6b24b",city:"Ponta Grossa"},
  {fn:"Erica",ln:"Fontes",job:"CEO",company:"Cellere Group",email:"fontes.erica@gruposervices.com.br",phone:"(19) 3209-0920",industry:"financial services",linkedin:"http://www.linkedin.com/in/%c3%a9rica-fontes-864229288",city:"Curitiba"},
  {fn:"Mara",ln:"Lima",job:"Commercial Coordinator",company:"Banco Moneo",email:"mara.lima@bancomoneo.com.br",phone:"(54) 2991-1004",industry:"financial services",linkedin:"http://www.linkedin.com/in/mara-regina-b-lima-a031a827",city:"Caxias do Sul"},
  {fn:"Felipe",ln:"Carvalho",job:"CEO",company:"Promotora CredForYou",email:"felipe.carvalho@credforyou.com.br",phone:"(88) 2145-0903",industry:"financial services",linkedin:"http://www.linkedin.com/in/felipe-carvalho-aab11b7b",city:"Fortaleza"},
  {fn:"Clayton",ln:"Marques",job:"CEO",company:"Grupo R.OSTON",email:"clayton@gruporoston.com.br",phone:"(19) 3244-5607",industry:"financial services",linkedin:"http://www.linkedin.com/in/clayton-marques-a4a66b6b",city:"Valinhos"},
  {fn:"Pedro",ln:"Souza",job:"Sócio e Diretor Comercial",company:"AG Antecipa",email:"pedro.souza@agantecipa.com.br",phone:"(19) 3232-6067",industry:"financial services",linkedin:"http://www.linkedin.com/in/pedrolsouza",city:"Sao Paulo"},
  {fn:"Elmir",ln:"Junior",job:"IT Supervisor",company:"Prime Consultoria Empresarial",email:"elmir.junior@primempresarial.com.br",phone:"(19) 3518-7000",industry:"financial services",linkedin:"http://www.linkedin.com/in/elmir-manso-maciel-junior-895a4254",city:"Bessemer"},
  {fn:"Cassio",ln:"Krupinsk",job:"CEO",company:"BLOCKBR",email:"cassio@blockbr.com.br",phone:"(11) 3197-0269",industry:"capital markets",linkedin:"http://www.linkedin.com/in/cassiokrupinsk",city:"Sao Paulo"},
  {fn:"Angela",ln:"Felippi",job:"Commercial Supervisor",company:"Banco do Vale",email:"angela@bancodovale.org.br",phone:"(47) 3222-1338",industry:"banking",linkedin:"http://www.linkedin.com/in/angela-felippi-7ba96778",city:"Indaial"},
  {fn:"Silvio",ln:"Monteiro",job:"Diretor de TI | CTO | CISO",company:"Intrabank",email:"silvio.monteiro@intrabank.com.br",phone:"(11) 4673-3300",industry:"financial services",linkedin:"http://www.linkedin.com/in/silvio-monteiro-62a560120",city:"Sao Paulo"},
  {fn:"Felipe",ln:"Trindade",job:"CEO",company:"Climbe Investimentos",email:"felipe@climbe.com.br",phone:"(79) 99119-8384",industry:"financial services",linkedin:"http://www.linkedin.com/in/felipe-trindade-cnpi-7a321973",city:"Aracaju"},
  {fn:"Renan",ln:"Medeiros",job:"Commercial Coordinator",company:"Acreditar FIDC",email:"renan.medeiros@acreditarfidc.com.br",phone:"(11) 4312-0264",industry:"banking",linkedin:"http://www.linkedin.com/in/renan-medeiros-30056033",city:"Suzano"},
  {fn:"Luciana",ln:"Ferreira",job:"Commercial Coordinator",company:"Sicoob Cecremec",email:"luciana.ferreira@cecremec.com.br",phone:"(61) 4000 1111",industry:"financial services",linkedin:"http://www.linkedin.com/in/luciana-s-vieira-ferreira-639174225",city:"Contagem"},
  {fn:"Daniel",ln:"Soares",job:"CEO",company:"Enix Finance",email:"daniel@enix.finance",phone:"(91) 98628-3763",industry:"financial services",linkedin:"http://www.linkedin.com/in/danielsoares78",city:"Balneario Camboriu"},
  {fn:"Isabela",ln:"Fechio",job:"Commercial Supervisor",company:"Flamex",email:"isabela.fechio@flamexnet.com.br",phone:"(41) 3071-5900",industry:"financial services",linkedin:"http://www.linkedin.com/in/isabela-fechio-a1932a205",city:"Londrina"},
  {fn:"Victoria",ln:"Semensato",job:"Commercial Supervisor",company:"ACG | PagCorp",email:"victoria.goncalves@acgsa.com.br",phone:"(11) 3074-3400",industry:"financial services",linkedin:"http://www.linkedin.com/in/victoria-semensato-bb407b156",city:"Sao Paulo"},
  {fn:"Marcelo",ln:"Martorelli",job:"CEO",company:"NYC Digital",email:"marcelo.martorelli@nycdigital.com.br",phone:"(11) 91064-4163",industry:"financial services",linkedin:"http://www.linkedin.com/in/marcelo-martorelli",city:"Sao Paulo"},
  {fn:"Renato",ln:"Coelho",job:"CEO @gobank",company:"Go Bank",email:"renato.coelho@gobank.com.br",phone:"(11) 4963-4199",industry:"financial services",linkedin:"http://www.linkedin.com/in/renato-coelho-047a6471",city:"Sao Paulo"},
  {fn:"Matheus",ln:"Amaral",job:"CEO",company:"Mais",email:"mais@maisscfi.com",phone:"(48) 9934-0438",industry:"financial services",linkedin:"http://www.linkedin.com/in/mba94",city:"Florianopolis"},
  {fn:"Bernardo",ln:"Brites",job:"CEO and Co-Founder",company:"Trace Finance",email:"bb@tracefinance.com",phone:"(21) 99375-8890",industry:"financial services",linkedin:"http://www.linkedin.com/in/bebrites",city:"New York"},
  {fn:"Tiago",ln:"Pisteli",job:"IT Coordinator",company:"Sicoob Crediçucar",email:"tiago.pisteli@credicucar.com.br",phone:"(19) 2660-3250",industry:"investment management",linkedin:"http://www.linkedin.com/in/tiago-pisteli",city:"Santa Cruz das Palmeiras"},
  {fn:"Gabriel",ln:"Duque",job:"Diretor Comercial & Private Banker",company:"LinQ Investimentos",email:"gabriel.duque@xpi.com.br",phone:"(21) 3094-4911",industry:"financial services",linkedin:"http://www.linkedin.com/in/gabriel-duque-37a0371b8",city:"Rio de Janeiro"},
  {fn:"Silvestre",ln:"Augusto",job:"CEO",company:"Conta AMcash",email:"silvestre@amcash.com.br",phone:"(92) 3042-2252",industry:"financial services",linkedin:"http://www.linkedin.com/in/silvestreaac",city:"Manaus"},
  {fn:"Eder",ln:"Batista",job:"IT Coordinator",company:"Wow Solution",email:"ederbatista@flowsolutionsbr.com",phone:"(11) 4550-7420",industry:"financial services",linkedin:"http://www.linkedin.com/in/eder-batista-1202a875",city:"Ribeirao Preto"},
  {fn:"Rafael",ln:"Bezerra",job:"Founder and CEO",company:"Banco Monetiza",email:"rafael.bezerra@bancomonetiza.com.br",phone:"(35)99771-7009",industry:"banking",linkedin:"http://www.linkedin.com/in/rafael-bezerra-818850101",city:"Manaus"},
  {fn:"Tayguara",ln:"Helou",job:"Chief CEO",company:"Urbano Bank",email:"tayguara@urbanobank.com",phone:"(11) 2224-3333",industry:"financial services",linkedin:"http://www.linkedin.com/in/tayguara-helou-57a68a125",city:"Sao Paulo"},
  {fn:"Davi",ln:"Cipriano",job:"CEO",company:"FIDEM Bank",email:"davi.cipriano@fidembank.com",phone:"(55) 3217 1227",industry:"financial services",linkedin:"http://www.linkedin.com/in/davi-cipriano-984a961b8",city:"Santa Maria"},
  {fn:"Wander",ln:"Curzio",job:"Diretor Comercial e Financeiro",company:"Escob-Cred",email:"wander@escobcred.com.br",phone:"(61) 4000-1111",industry:"financial services",linkedin:"http://www.linkedin.com/in/wander-curzio-97426826",city:"Sao Paulo"},
  {fn:"Magda",ln:"Portugal",job:"CEO",company:"Portogallo Family Office",email:"magda@portogalloinvestimentos.com.br",phone:"(11) 3078.6830",industry:"investment management",linkedin:"http://www.linkedin.com/in/mportugal2007",city:"Sao Paulo"},
  {fn:"Jefferson",ln:"Chaves",job:"Marketing Supervisor",company:"Featbank",email:"jefferson.chaves@featbank.com.br",phone:"(11) 3181-6151",industry:"financial services",linkedin:"http://www.linkedin.com/in/jefferson-almeida-chaves-59032364",city:"Sao Paulo"},
  {fn:"Cristiane",ln:"Anjos",job:"CEO",company:"Promotora CredForYou",email:"cristiane.dosanjos@credforyou.com.br",phone:"(88) 99623-8397",industry:"financial services",linkedin:"http://www.linkedin.com/in/cristiane-dos-anjos-12a3b123a",city:"Fortaleza"},
  {fn:"Fernando",ln:"Masiero",job:"CEO",company:"X3Promotora",email:"fernandomasiero@x3promotora.com.br",phone:"(35) 3311-3920",industry:"financial services",linkedin:"http://www.linkedin.com/in/fernando-torres-masiero-529435322",city:"Pouso Alegre"},
  {fn:"Jefferson",ln:"Rodrigues",job:"Commercial Supervisor",company:"CashGO",email:"jefferson.rodrigues@cashgo.com.br",phone:"(11) 93213-9251",industry:"financial services",linkedin:"http://www.linkedin.com/in/jefferson-rodrigues-5b2097111",city:"Sao Paulo"},
  {fn:"Diego",ln:"Motta",job:"Commercial Director",company:"GIRO.TECH",email:"diego.motta@girotech.com.br",phone:"(41) 4042-0480",industry:"financial services",linkedin:"http://www.linkedin.com/in/diego-motta-2813406b",city:"Sao Paulo"},
  {fn:"Jamile",ln:"Hora",job:"Commercial Coordinator",company:"Credifit",email:"jamile@credifit.com.br",phone:"(71) 3493-3974",industry:"financial services",linkedin:"http://www.linkedin.com/in/jamile-hora-ba2360222",city:"Salvador"},
  {fn:"Gustavo",ln:"Henrique",job:"Fundador & CEO",company:"Escapay",email:"gustavo.henrique@escapay.com.br",phone:"(54) 3029-6681",industry:"financial services",linkedin:"http://www.linkedin.com/in/gustavohenriqueescapay",city:"Sao Paulo"},
  {fn:"Marcelo",ln:"Liberman",job:"CEO",company:"B8 Partners",email:"marcelo.liberman@b8.partners",phone:"(11) 3165-4810",industry:"financial services",linkedin:"http://www.linkedin.com/in/marcelo-liberman-0b53b432",city:"Sao Paulo"},
  {fn:"Kenneth",ln:"Ribeiro",job:"CEO",company:"VALUE PROMOTORA",email:"kenneth@valuepromotora.com.br",phone:"(19) 3841-8833",industry:"banking",linkedin:"http://www.linkedin.com/in/kenneth-vinicius-ribeiro-57293759",city:"Sao Paulo"},
  {fn:"Kaue",ln:"Godoy",job:"Sócio Fundador e Diretor Comercial",company:"Ômega Invest",email:"kaue.godoy@investomega.com.br",phone:"(11) 3230-5410",industry:"financial services",linkedin:"http://www.linkedin.com/in/kau%c3%aa-godoy",city:"Sao Paulo"},
  {fn:"Brad",ln:"Liebmann",job:"Founder, CEO",company:"alt.bank",email:"brad@altbank.co",phone:"(11) 2222-1149",industry:"financial services",linkedin:"http://www.linkedin.com/in/liebmann",city:"Sao Paulo"},
  {fn:"Bernardo",ln:"Assumpcao",job:"CEO",company:"Arton Advisors",email:"bernardo.assumpcao@artonadvisors.com.br",phone:"(11) 3181-2450",industry:"financial services",linkedin:"http://www.linkedin.com/in/bernardo-patury-assumpcao-11800a10",city:"Sao Paulo"},
  {fn:"Fabian",ln:"Valverde",job:"CEO",company:"Paketá",email:"fabian@paketa.com.br",phone:"(11) 3500-1566",industry:"financial services",linkedin:"http://www.linkedin.com/in/fabianvalverde",city:"Sao Paulo"},
  {fn:"Pedro",ln:"Vettorazzi",job:"Commercial Coordinator",company:"Banco Randon",email:"pedro.vettorazzi@bancorandon.com",phone:"(54) 3239-4600",industry:"banking",linkedin:"http://www.linkedin.com/in/pedro-luiz-sartori-vettorazzi-1b74b713a",city:"Caxias do Sul"},
  {fn:"Fernando",ln:"Wunderlich",job:"Co-Founder e Diretor de Marketing",company:"Novo Saque",email:"fernando@novosaque.com.br",phone:"(48) 3030-0900",industry:"financial services",linkedin:"http://www.linkedin.com/in/fernandohw",city:"Florianopolis"},
  {fn:"Aline",ln:"Silva",job:"CEO",company:"AssGroup",email:"aline@assgroup.com.br",phone:"(11) 97301-6459",industry:"financial services",linkedin:"http://www.linkedin.com/in/aline-silva-5b5bb7288",city:"Sao Paulo"},
  {fn:"Marcus",ln:"Nunes",job:"Presidente-CEO",company:"Banco Cassems",email:"marcus.nunes@bancocassems.com.br",phone:"(67) 3314-9800",industry:"financial services",linkedin:"http://www.linkedin.com/in/marcusvenunes",city:"Campo Grande"},
  {fn:"Antonio",ln:"Junior",job:"CEO",company:"Neo Securitizadora",email:"junior@neofomento.com.br",phone:"(11) 24738-550",industry:"financial services",linkedin:"http://www.linkedin.com/in/antonio-viscaino-junior-15482b58",city:"Braganca Paulista"},
  {fn:"Beatriz",ln:"Cancado",job:"CEO",company:"B23 Parcelamentos",email:"beatriz@b23s.com.br",phone:"(19) 3869-6933",industry:"banking",linkedin:"http://www.linkedin.com/in/beatriz-can%c3%a7ado-031528313",city:"Brasilia"},
  {fn:"Higor",ln:"Silveira",job:"Commercial Supervisor",company:"Sicoob Coopvale",email:"higor.silveira@sicoobcoopvale.com.br",phone:"(91) 3197-0040",industry:"banking",linkedin:"http://www.linkedin.com/in/higor-silveira-16a342149",city:"Governador Valadares"},
  {fn:"Fellipe",ln:"Nogueira",job:"Sócio & Diretor Comercial",company:"AMG Capital",email:"fellipe.nogueira@amgcapital.com.br",phone:"(11) 3077-4600",industry:"financial services",linkedin:"http://www.linkedin.com/in/fellipe-nogueira-mba-4252aa32",city:""},
  {fn:"Paulo",ln:"Brambilla",job:"Commercial Director",company:"Prime Reserve Capital",email:"paulo.brambilla@primereserve.com.br",phone:"(41) 99612-2914",industry:"financial services",linkedin:"http://www.linkedin.com/in/paulo-brambilla-9069ab5a",city:"Curitiba"},
  {fn:"Eduardo",ln:"Campos",job:"CEO",company:"Láurea Capital",email:"emc@laureacapital.com",phone:"(11) 3230-0774",industry:"investment banking",linkedin:"http://www.linkedin.com/in/eduardo-matias-campos-697bb351",city:"Sao Paulo"},
  {fn:"Ronaldo",ln:"Delevati",job:"Consultor de Valores Mobiliários",company:"MoMA Investimentos",email:"ronaldo@momafo.com.br",phone:"(51) 99816-2469",industry:"investment management",linkedin:"http://www.linkedin.com/in/ronaldo-delevati-m-sc-841a9522",city:"Porto Alegre"},
  {fn:"Eduardo",ln:"Daghum",job:"Founder and CEO",company:"Horus Group",email:"edaghum@horusgrp.com.br",phone:"(15) 3023-2262",industry:"financial services",linkedin:"http://www.linkedin.com/in/eduardo-daghum-6235208",city:"Sao Paulo"},
  {fn:"Roberto",ln:"Cunha",job:"CEO",company:"Osten Invest",email:"roberto.cunha@osteninvest.com.br",phone:"(11) 10997987",industry:"financial services",linkedin:"http://www.linkedin.com/in/roberto-cunha-64147612",city:"Sao Paulo"},
  {fn:"Felipe",ln:"Simonetti",job:"CEO",company:"Fixxinvest",email:"felipe.simonetti@fixxinvest.com.br",phone:"(11) 99140-9393",industry:"investment management",linkedin:"http://www.linkedin.com/in/felipe-simonetti-ba71b3251",city:"Paranavai"},
  {fn:"Fabricio",ln:"Gadotti",job:"CEO",company:"ConectaPag",email:"fabricio@conectapagamentos.com.br",phone:"(42) 3311-4008",industry:"banking",linkedin:"http://www.linkedin.com/in/fabricio-fernando-gadotti-b85ba58",city:"Blumenau"},
  {fn:"Valero",ln:"Guidotti",job:"CEO",company:"Ponto Amigo",email:"valero@pontoamigo.com.br",phone:"(81) 3314-1822",industry:"financial services",linkedin:"http://www.linkedin.com/in/valero-guidotti",city:"Recife"},
  {fn:"Scott",ln:"Anthony",job:"Chief Executive Officer",company:"OURO",email:"scott@ouro.ae",phone:"(65) 2127-2740",industry:"financial services",linkedin:"http://www.linkedin.com/in/wiredceo",city:"Dubai"},
  {fn:"Jonatham",ln:"Nevis",job:"Commercial Director",company:"Banco Ápia",email:"jonatham.nevis@bancoapia.com.br",phone:"(28) 99985-7642",industry:"banking",linkedin:"http://www.linkedin.com/in/jonatham-marks-nevis-03864121a",city:"Cachoeiro de Itapemirim"},
  {fn:"Ettore",ln:"Marchetti",job:"CEO",company:"EQI Asset",email:"ettore.marchetti@eqiasset.com.br",phone:"(47) 4007-2374",industry:"banking",linkedin:"http://www.linkedin.com/in/ettore-marchetti-25716948",city:"Sao Paulo"},
  {fn:"Ricardo",ln:"Spezia",job:"CEO",company:"Next Auditores",email:"ricardo@nextauditores.com.br",phone:"(47) 3288-1979",industry:"investment management",linkedin:"http://www.linkedin.com/in/ricardo-artur-spezia-971ab252",city:"Blumenau"},
  {fn:"Allan",ln:"Rinki",job:"Coordenador de TI",company:"Sicoob Médio Oeste",email:"allan.rinki@sicoob.com.br",phone:"(44) 3928-0900",industry:"financial services",linkedin:"http://www.linkedin.com/in/allan-rinki-5919b457",city:"Assis Chateaubriand"},
  {fn:"Carla",ln:"Weiss",job:"CEO",company:"Opta Promotora",email:"carla.weiss@optapromotora.com.br",phone:"(45) 99818-5991",industry:"financial services",linkedin:"http://www.linkedin.com/in/carla-andreia-weiss-a6068642",city:"Medianeira"},
  {fn:"Marcelo",ln:"Brum",job:"Commercial Coordinator",company:"OXY Companhia Hipotecária",email:"marcelo.brum@chphipotecaria.com.br",phone:"(51) 3515-6200",industry:"financial services",linkedin:"http://www.linkedin.com/in/marcelo-cardoso-brum-16a85b74",city:"Porto Alegre"},
  {fn:"Vinicius",ln:"Ribeiro",job:"CEO",company:"Wirespay",email:"vinicius.ribeiro@wirespay.com.br",phone:"(11) 94286-5599",industry:"financial services",linkedin:"http://www.linkedin.com/in/vin%c3%adcius-ribeiro-10b7b7171",city:"Rio Branco"},
  {fn:"Janaina",ln:"Ferraz",job:"Commercial Supervisor",company:"Consórcio Nacional Unifisa",email:"janaina.ferraz@unifisa.com.br",phone:"(11) 3039-2300",industry:"banking",linkedin:"http://www.linkedin.com/in/janaina-ferraz-5986151b5",city:"Santo Andre"},
  {fn:"Jose",ln:"Portela",job:"CEO",company:"Tutors Participações",email:"portela@tutorsparticipacoes.com",phone:"(65) 2127-2740",industry:"financial services",linkedin:"http://www.linkedin.com/in/admjoseleaoportela",city:"Cuiaba"},
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const errorLog: { email: string; error: string }[] = [];
  const seenEmails = new Set<string>();

  for (const lead of DATA) {
    const email = lead.email?.trim().toLowerCase();
    if (!email) { skipped++; continue; }
    // Dedup within the list itself
    if (seenEmails.has(email)) { skipped++; continue; }
    seenEmails.add(email);

    try {
      // Check if contact already exists
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("email", email)
        .eq("empresa", EMPRESA)
        .eq("is_active", true)
        .limit(1);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      const nome = `${lead.fn} ${lead.ln}`.trim() || email;

      // Insert contact
      const { data: contact, error: cErr } = await supabase
        .from("contacts")
        .insert({
          nome,
          primeiro_nome: lead.fn || null,
          sobrenome: lead.ln || null,
          email,
          telefone: lead.phone || null,
          empresa: EMPRESA,
          canal_origem: "LISTA_AXIA",
          tags: ["Lista Axia"],
          linkedin_url: lead.linkedin || null,
          linkedin_cargo: lead.job || null,
          linkedin_empresa: lead.company || null,
          linkedin_setor: lead.industry || null,
        })
        .select("id")
        .single();

      if (cErr) throw cErr;

      // Insert deal
      const { error: dErr } = await supabase
        .from("deals")
        .insert({
          titulo: nome,
          contact_id: contact.id,
          pipeline_id: PIPELINE_ID,
          stage_id: STAGE_ID,
          owner_id: OWNER_ID,
          status: "ABERTO",
          temperatura: "FRIO",
          canal_origem: "LISTA_AXIA",
          valor: 0,
        });

      if (dErr) throw dErr;

      imported++;
    } catch (e: unknown) {
      errors++;
      errorLog.push({ email, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return new Response(
    JSON.stringify({ total: DATA.length, imported, skipped, errors, errorLog }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
