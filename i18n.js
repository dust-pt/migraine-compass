/* Language follows the operating system: Portuguese (Portugal) when the phone is in Portuguese, English otherwise. */
'use strict';
const LANG = ((navigator.languages && navigator.languages[0]) || navigator.language || 'en').toLowerCase().startsWith('pt') ? 'pt' : 'en';
const LOC = LANG === 'pt' ? 'pt-PT' : 'en-GB';
document.documentElement.lang = LOC;
const PT = {
  // options
  'Now': 'Agora', '1 h ago': 'Há 1 h', 'Earlier today': 'Mais cedo hoje', 'Yesterday': 'Ontem', 'Yes': 'Sim', 'No': 'Não',
  'Irregular schedule': 'Horário irregular', 'Skipped exercise': 'Não fiz exercício', 'More exercise': 'Mais exercício', 'Sun exposure': 'Exposição ao sol',
  'Trip': 'Viagem', 'Late night': 'Deitei-me tarde', 'Menstruation': 'Menstruação', 'No change': 'Sem alterações',
  'Skipped a meal': 'Saltei uma refeição', 'Late meal': 'Refeição tardia', 'Coffee': 'Café', 'Alcohol': 'Álcool', 'Chocolate': 'Chocolate',
  'Aged cheese': 'Queijo curado', 'Processed food': 'Comida processada', 'Little water': 'Pouca água', 'Nothing unusual': 'Nada fora do normal',
  'Stressed': 'Stress', 'Anxious': 'Ansiedade', 'Sad': 'Tristeza', 'Irritable': 'Irritação', 'Tired': 'Cansaço', 'Calm': 'Calma', 'Happy': 'Alegria', 'Excited': 'Entusiasmo',
  'Took medication': 'Tomei medicação', 'No medication': 'Sem medicação', 'Dark room': 'Quarto escuro', 'Rest': 'Descanso', 'Sleep': 'Dormir',
  'Red wine': 'Vinho tinto', 'Citrus fruit': 'Citrinos', 'Cured meats': 'Enchidos', 'Artificial sweeteners': 'Adoçantes artificiais', 'Energy drink': 'Bebida energética', 'Fasting': 'Jejum',
  'Nauseous': 'Náuseas', 'Dizzy': 'Tonturas', 'Sensitive to light': 'Sensibilidade à luz', 'Sensitive to noise': 'Sensibilidade ao ruído', 'Aura': 'Aura',
  'Neck pain': 'Dor no pescoço', 'Overwhelmed': 'Sobrecarga', 'min': 'min', 'hours': 'horas', 'days': 'dias', 'Slept under 6 h': 'Dormi menos de 6 h',
  'Food and drink': 'Comida e bebida', 'How are you feeling?': 'Como se sente?', 'Feelings': 'Emoções',
  // navigation and home
  'Home': 'Início', 'History': 'Histórico', 'Summary': 'Resumo', 'Settings': 'Definições', 'How are you today?': 'Como está hoje?',
  'Log a migraine': 'Registar uma enxaqueca', 'Three quick steps: when and routine, food and feelings, what helped.': 'Três passos rápidos: início e rotina, comida e emoções, o que ajudou.',
  'Start ›': 'Começar ›', 'Last migraine': 'Última enxaqueca', 'This month': 'Este mês', 'See History ›': 'Ver histórico ›',
  'Doctor visit coming up?': 'Consulta médica em breve?', 'The app reads your full history and drafts a summary you can review and email.': 'A app lê todo o seu histórico e prepara um resumo que pode rever e enviar por email.',
  'Prepare doctor summary': 'Preparar resumo para o médico', 'Nothing logged yet': 'Ainda sem registos',
  // steps
  'When did it start?': 'Quando começou?', 'How strong it is, and what changed in the last 24 hours.': 'Qual a intensidade e o que mudou nas últimas 24 horas.',
  'Filled in automatically': 'Preenchido automaticamente', 'Sleep last night': 'Sono da última noite', 'Weather': 'Tempo', 'Screen time': 'Tempo de ecrã',
  'With your permission: smartwatch, weather change since yesterday, phone. Sample data.': 'Com a sua autorização: smartwatch, mudança do tempo desde ontem, telemóvel. Dados de exemplo.',
  'Started': 'Começou', 'Intensity (1 = mild, 10 = severe)': 'Intensidade (1 = ligeira, 10 = muito forte)', 'Still ongoing?': 'Ainda continua?',
  'How long did it last?': 'Quanto tempo durou?', 'Any change in routine?': 'Alguma mudança na rotina?',
  'Menstruation is optional and only appears if you turn it on in Settings.': 'A menstruação é opcional e só aparece se a ativar nas Definições.',
  'Food, drink and feelings': 'Comida, bebida e emoções', 'Select what applies. Everything is optional.': 'Selecione o que se aplica. Tudo é opcional.',
  'What happened after?': 'O que aconteceu depois?', 'Medication and what helped. Everything here is optional.': 'Medicação e o que ajudou. Tudo aqui é opcional.',
  'Medication taken': 'Medicação tomada', 'What helped': 'O que ajudou', 'Note (optional)': 'Nota (opcional)',
  'Tap to write anything else worth remembering…': 'Toque para escrever algo mais que valha a pena lembrar…', 'Save migraine': 'Guardar enxaqueca',
  'Next': 'Seguinte', 'Skip this step': 'Saltar este passo', '‹ Back': '‹ Voltar', 'Less': 'Menos', 'More': 'Mais',
  'Migraine logged': 'Enxaqueca registada', 'It has been added to your History. Take care of yourself.': 'Foi adicionada ao seu histórico. Cuide de si.',
  'Go to History': 'Ver histórico', 'Back to Home': 'Voltar ao início',
  // history
  '30 days': '30 dias', '6 months': '6 meses', 'All time': 'Sempre', 'in the last 30 days': 'nos últimos 30 dias', 'Migraines per month': 'Enxaquecas por mês',
  'Most logged alongside a migraine': 'O que mais aparece com uma enxaqueca', 'Log a few migraines to see what comes up most.': 'Registe algumas enxaquecas para ver o que aparece mais.',
  'Counts from your past entries only.': 'Contagens apenas dos seus registos.', 'Counts from your past entries only. Sample data.': 'Contagens apenas dos seus registos. Dados de exemplo.',
  // summary
  'Doctor summary': 'Resumo para o médico', 'No migraines logged in the last 6 months yet. Log one and a summary will appear here.': 'Ainda não há enxaquecas registadas nos últimos 6 meses. Registe uma e o resumo aparece aqui.',
  'Drafted by AI from your full history': 'Redigido por IA a partir de todo o histórico', 'Improving with AI…': 'A melhorar com IA…',
  'Drafted automatically from your entries': 'Redigido automaticamente a partir dos seus registos', 'Review and edit before you share it.': 'Reveja e edite antes de partilhar.',
  'Frequency': 'Frequência', 'Intensity & duration': 'Intensidade e duração', 'Logged alongside': 'Registado em conjunto', 'Questions for the doctor': 'Perguntas para o médico',
  'Add your own before sending…': 'Acrescente as suas antes de enviar…', 'Improving…': 'A melhorar…', 'Improved with AI ✓': 'Melhorado com IA ✓', 'Improve with AI': 'Melhorar com IA',
  'Done editing': 'Concluir edição', 'Edit text': 'Editar texto', 'Send by email': 'Enviar por email', 'Migraine summary': 'Resumo de enxaquecas',
  'Nothing logged alongside yet.': 'Ainda nada registado em conjunto.',
  // settings
  'Night mode': 'Modo noturno', 'Darker, softer colours for light sensitivity.': 'Cores mais escuras e suaves para quem é sensível à luz.',
  'Follow phone': 'Como o telemóvel', 'On': 'Ligado', 'Off': 'Desligado', 'Show “Menstruation” option': 'Mostrar a opção “Menstruação”', 'Extra options': 'Opções extra',
  'Turn on options that are not in the app by default. They appear in the “Food, drink and feelings” step.': 'Ative opções que não vêm na app por defeito. Aparecem no passo “Comida, bebida e emoções”.',
  'Tap an option to turn it on or off. Options you added yourself can be deleted with ×.': 'Toque numa opção para a ligar ou desligar. As opções que criou podem ser apagadas com ×.',
  'Add your own': 'Acrescentar as suas', 'e.g. Blurred vision': 'ex.: Visão turva', 'Add': 'Adicionar', 'Test data': 'Dados de teste',
  'Fictional entries so you can explore History and the doctor summary.': 'Registos fictícios para explorar o histórico e o resumo para o médico.',
  'Load sample data': 'Carregar dados de exemplo', 'Delete all': 'Apagar tudo', 'Your entries are stored only on this device.': 'Os seus registos ficam guardados apenas neste dispositivo.',
  // messages
  'AI is unavailable right now. Kept the automatic text.': 'A IA não está disponível agora. Mantive o texto automático.', 'Type an option first': 'Escreva primeiro uma opção',
  'That option already exists': 'Essa opção já existe', 'Sample data loaded': 'Dados de exemplo carregados', 'All entries deleted': 'Todos os registos foram apagados',
  'Delete all migraine entries on this device?': 'Apagar todos os registos de enxaqueca neste dispositivo?', 'Tap a bar to see how long each migraine lasted.': 'Toque numa barra para ver quanto durou cada enxaqueca.',
  'Duration of each migraine': 'Duração de cada enxaqueca', '‹ All months': '‹ Todos os meses', 'No migraines logged this month.': 'Sem enxaquecas registadas neste mês.',
  'ongoing': 'a decorrer', 'not recorded': 'sem registo', 'Migraine in progress': 'Enxaqueca a decorrer', 'It ended': 'Terminou', 'Duration': 'Duração', 'Save': 'Guardar',
  'Filled in with the time since it started. Change it if it ended earlier.': 'Preenchido com o tempo desde que começou. Altere se terminou mais cedo.',
  'Saved. Take care of yourself.': 'Guardado. Cuide de si.', 'See durations ›': 'Ver durações ›', 'Tap a migraine to see what you logged.': 'Toque numa enxaqueca para ver o que registou.',
  'Routine': 'Rotina', 'Nothing else logged.': 'Nada mais registado.', 'Your entries are not saved in the cloud.': 'Os seus registos não são guardados na nuvem.', 'Feedback': 'Sugestões', 'Have a suggestion or found a problem? Tell the team in a short, anonymous form.': 'Tem uma sugestão ou encontrou um problema? Diga-nos num formulário curto e anónimo.',
  'Add/remove': 'Adicionar/remover',
  'Write another option': 'Escrever outra opção',
  'Done': 'Concluído',
  'Tap × to remove an option, + to add one.': 'Toque em × para remover uma opção e em + para adicionar.',
  'More options': 'Mais opções',
  'Answer the evaluation form': 'Responder ao questionário de avaliação',
  'Thank you for trying the app': 'Obrigado por experimentar a app',
  'You have logged 3 migraines. Would you answer a short form about the app? It takes about 5 minutes and is anonymous.': 'Já registou 3 enxaquecas. Pode responder a um questionário curto sobre a app? Demora cerca de 5 minutos e é anónimo.',
  'Answer the form': 'Responder',
  'Not now': 'Agora não',
  'Send a suggestion': 'Enviar sugestão', 'Suggestions go to a Google form. Please do not write your name or personal health details.': 'As sugestões vão para um formulário Google. Não escreva o seu nome nem dados de saúde pessoais.', 'rain': 'chuva', 'Location off': 'Localização desligada'
};
const L = s => (LANG === 'pt' && PT[s]) || s;
// Text with numbers
const TX = {
  since: (when, dur) => LANG === 'pt' ? `Desde ${when} · há ${dur}` : `Since ${when} · ${dur} ago`,
  startedAt: when => LANG === 'pt' ? `Começou ${when}.` : `Started ${when}.`,
  detailHead: (t, n) => LANG === 'pt' ? `Começou às ${t} · intensidade ${n}/10` : `Started at ${t} · intensity ${n}/10`,
  stepOf: (n, t) => LANG === 'pt' ? `Passo ${n} de ${t}` : `Step ${n} of ${t}`,
  migraines: n => LANG === 'pt' ? `${n} enxaqueca${n === 1 ? '' : 's'}` : `${n} migraine${n === 1 ? '' : 's'}`,
  logged: n => LANG === 'pt' ? `${n} enxaqueca${n === 1 ? '' : 's'} registada${n === 1 ? '' : 's'}` : `${n} migraine${n === 1 ? '' : 's'} logged`,
  intensity: n => LANG === 'pt' ? `intensidade ${n}/10` : `intensity ${n}/10`,
  about: d => LANG === 'pt' ? `cerca de ${d}` : `about ${d}`,
  per: p => (LANG === 'pt' ? { '30d': 'em 30 dias', '6m': 'em 6 meses', all: 'no total' } : { '30d': 'in 30 days', '6m': 'in 6 months', all: 'in total' })[p],
  days: n => LANG === 'pt' ? `${n} dia${n >= 2 ? 's' : ''}` : `${n} day${n >= 2 ? 's' : ''}`,
  added: s => LANG === 'pt' ? `Adicionada a ${s}` : `Added to ${s}`,
  deleted: v => LANG === 'pt' ? `“${v}” apagada` : `Deleted “${v}”`,
  deleteLabel: v => LANG === 'pt' ? `Apagar ${v}` : `Delete ${v}`,
  sumFreq: (n, m) => LANG === 'pt' ? `${n} enxaqueca${n === 1 ? '' : 's'} em 6 meses, ${m} nos últimos 30 dias.` : `${n} migraine${n === 1 ? '' : 's'} in 6 months, ${m} in the last 30 days.`,
  sumInt: (r, d) => LANG === 'pt' ? `Normalmente ${r} em 10${d ? `, com duração de cerca de ${d} horas` : ''}.` : `Usually ${r} out of 10${d ? `, lasting about ${d} hours` : ''}.`
};
