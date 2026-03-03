/**
 * BACKEND GOOGLE APPS SCRIPT PARA ATIVIDADE DE CIÊNCIAS 6º ANO
 * ID DA PLANILHA: 1F1qUYkW9--r8U2eCHvOpruZue-HdQRh9T5HroiE5Rws
 */

const SPREADSHEET_ID = '1F1qUYkW9--r8U2eCHvOpruZue-HdQRh9T5HroiE5Rws';
const GEMINI_API_KEY = 'SUA_CHAVE_API_AQUI'; // <--- INSIRA SUA CHAVE DO GOOGLE GEMINI AQUI

/**
 * Função que recebe o POST do formulário HTML
 */
function doPost(e) {
  try {
    // Tenta ler o corpo da requisição de várias formas para garantir compatibilidade
    let contents = "";
    if (e.postData.getDataAsString) {
      contents = e.postData.getDataAsString();
    } else if (e.postData.contents) {
      contents = e.postData.contents;
    }
    
    const data = JSON.parse(contents);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // LOG DE DEBUG: Registra o que está chegando
    try {
      let logSheet = ss.getSheetByName('DEBUG_LOGS');
      if (!logSheet) logSheet = ss.insertSheet('DEBUG_LOGS');
      logSheet.appendRow([new Date(), "POST RECEBIDO", JSON.stringify(data)]);
    } catch(err) {}

    // Identificar escola e nome base da aba
    let schoolLabel = 'LYDIA';
    if (data.escola && data.escola.toUpperCase() === 'WANDA') {
      schoolLabel = 'WANDA';
    }

    // Busca Robusta de Aba
    let sheet = null;
    const allSheets = ss.getSheets();
    for (let s of allSheets) {
      const name = s.getName().toUpperCase();
      if (name.includes(schoolLabel) || (schoolLabel === 'LYDIA' && name.includes('ATIVIDADES'))) {
        sheet = s;
        break;
      }
    }
    
    // Se não achou, cria com nome padrão
    if (!sheet) {
      const defaultName = schoolLabel === 'LYDIA' ? 'ATIVIDADES 6ªANO LYDIA' : 'ATIVIDADES 6ªANO WANDA MASCAGNI';
      sheet = ss.insertSheet(defaultName);
      sheet.appendRow(['Data/Hora', 'Turma', 'Nº', 'Nome', 'E-mail', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6 (IA)', 'Q7 (IA)', 'Q8 (IA)', 'Q9 (IA)', 'Q10 (IA)', 'Status Habilidades', 'Apontamentos']);
    }

    // Separar respostas objetivas (1-5) e discursivas (6-10)
    const respObj = (data.respostas || []).slice(0, 5).map(r => r.resposta || "");
    const respDis = (data.respostas || []).slice(5, 10).map(r => r.resposta || "");

    // Corrigir discursivas com IA (se configurado)
    let correcaoIA = { notas: [], statusGeral: "Pendente", apontamentos: "" };
    if (GEMINI_API_KEY && GEMINI_API_KEY !== 'SUA_CHAVE_API_AQUI') {
      correcaoIA = corrigirComIA(respDis);
    }
    
    // Garantir que temos 5 notas
    while (correcaoIA.notas.length < 5) {
      correcaoIA.notas.push("Não Avaliado");
    }

    // Montar a linha para a planilha
    const newRow = [
      data.timestamp || new Date().toLocaleString('pt-BR'),
      data.turma || "Não informada",
      data.numero || "",
      data.aluno || "Anônimo",
      data.email || "",
      ...respObj,
      ...correcaoIA.notas,
      correcaoIA.statusGeral || "Pendente",
      correcaoIA.apontamentos || ""
    ];

    sheet.appendRow(newRow);
    
    // Atualizar Gráficos
    try {
      atualizarGraficos(ss, data.escola);
    } catch(err) {
      console.log("Erro ao atualizar gráficos: " + err);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Respostas registradas com sucesso!' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    try {
       const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
       let logSheet = ss.getSheetByName('DEBUG_LOGS');
       if (!logSheet) logSheet = ss.insertSheet('DEBUG_LOGS');
       logSheet.appendRow([new Date(), "ERRO CRÍTICO", error.toString()]);
    } catch(e) {}
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Chama a API do Gemini para corrigir as questões
 */
function corrigirComIA(respostasDiscursivas) {
  const prompt = `
    Você é um professor de Ciências avaliando alunos do 6º ano de acordo com o Guia Priorizado do Estado de São Paulo.
    Avalie as seguintes 5 respostas discursivas sobre: Hipótese/Teoria, Big Bang, Planetas, Atmosfera Primitiva e Tempo Geológico.
    Para cada resposta, determine se a habilidade foi "Atingida" ou "Não Atingida".
    Retorne APENAS um JSON no formato:
    {
      "notas": ["Atingida", "Atingida", ...],
      "apontamentos": "Texto resumido com dicas pedagógicas para o aluno."
    }

    Respostas do Aluno:
    1. ${respostasDiscursivas[0]}
    2. ${respostasDiscursivas[1]}
    3. ${respostasDiscursivas[2]}
    4. ${respostasDiscursivas[3]}
    5. ${respostasDiscursivas[4]}
  `;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload) };
    
    const response = UrlFetchApp.fetch(url, options);
    const jsonRes = JSON.parse(response.getContentText());
    const candidates = jsonRes.candidates[0].content.parts[0].text;
    
    const cleanJson = candidates.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanJson);
    
    const atingidasCount = result.notas.filter(n => n === 'Atingida').length;
    result.statusGeral = `${atingidasCount}/5 Habilidades Atingidas`;
    
    return result;
  } catch (e) {
    return { 
      notas: ["Erro IA", "Erro IA", "Erro IA", "Erro IA", "Erro IA"], 
      statusGeral: "Erro na correção automática",
      apontamentos: "Não foi possível gerar apontamentos no momento."
    };
  }
}

/**
 * Cria ou atualiza a aba de Gráficos
 */
function atualizarGraficos(ss, escola) {
  let label = 'LYDIA';
  if (escola === 'Wanda') label = 'WANDA';

  // Buscar aba de dados correta de forma flexível
  let dataSheet = null;
  const allSheets = ss.getSheets();
  for (let s of allSheets) {
    const name = s.getName().toUpperCase();
    if (name.includes('ATIVIDADES') && name.includes(label)) {
      dataSheet = s;
      break;
    }
  }
  if (!dataSheet) return;

  // Buscar aba de gráficos correspondente
  let graphSheetName = `Gráficos - ${label.charAt(0) + label.slice(1).toLowerCase()}`;
  let graphSheet = ss.getSheetByName(graphSheetName);
  if (!graphSheet) graphSheet = ss.insertSheet(graphSheetName);
  
  graphSheet.clear();
  graphSheet.getCharts().forEach(c => graphSheet.removeChart(c));

  const values = dataSheet.getDataRange().getValues();
  if (values.length <= 1) return;
  const rawData = values.slice(1);

  const turmasLydia = ['6ºAno A', '6ºAno B', '6ºAno C'];
  const turmasWanda = ['6ºAno B', '6ºAno C'];
  const turmas = label === 'LYDIA' ? turmasLydia : turmasWanda;

  let currentTitleRow = 1;

  turmas.forEach((turma) => {
    const turmaData = rawData.filter(r => r[1] === turma);
    if (turmaData.length === 0) return;

    let totalAtingidas = 0;
    let totalNaoAtingidas = 0;

    turmaData.forEach(row => {
      for (let i = 10; i <= 14; i++) {
        if (row[i] === 'Atingida') totalAtingidas++;
        else totalNaoAtingidas++;
      }
    });

    const startRow = currentTitleRow + 1;
    graphSheet.getRange(currentTitleRow, 1).setValue(`Resumo de Habilidades - ${turma}`).setFontWeight('bold');
    graphSheet.getRange(startRow, 1).setValue('Status');
    graphSheet.getRange(startRow, 2).setValue('Quantidade');
    graphSheet.getRange(startRow + 1, 1).setValue('Atingidas');
    graphSheet.getRange(startRow + 1, 2).setValue(totalAtingidas);
    graphSheet.getRange(startRow + 2, 1).setValue('Não Atingidas');
    graphSheet.getRange(startRow + 2, 2).setValue(totalNaoAtingidas);

    const chart = graphSheet.newChart()
      .setChartType(Charts.ChartType.PIE)
      .addRange(graphSheet.getRange(startRow + 1, 1, 2, 2))
      .setPosition(currentTitleRow, 4, 0, 0)
      .setOption('title', `Habilidades ${turma}`)
      .setOption('pieHole', 0.4)
      .setOption('colors', ['#4CAF50', '#F44336'])
      .build();

    graphSheet.insertChart(chart);
    currentTitleRow += 15;
  });
}
