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
    const data = JSON.parse(e.postData.getDataAsString());
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    let mainSheetName = 'ATIVIDADES 6ªANO LYDIA';
    if (data.escola === 'Wanda') {
      mainSheetName = 'ATIVIDADES 6ªANO WANDA MASCAGNI';
    }

    let sheet = ss.getSheetByName(mainSheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(mainSheetName);
      sheet.appendRow(['Data/Hora', 'Turma', 'Nº', 'Nome', 'E-mail', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6 (IA)', 'Q7 (IA)', 'Q8 (IA)', 'Q9 (IA)', 'Q10 (IA)', 'Status Habilidades', 'Apontamentos']);
    }

    // Separar respostas objetivas (1-5) e discursivas (6-10)
    const respObj = data.respostas.slice(0, 5).map(r => r.resposta);
    const respDis = data.respostas.slice(5, 10).map(r => r.resposta);

    // Corrigir discursivas com IA
    const correcaoIA = corrigirComIA(respDis);
    
    // Montar a linha para a planilha
    const newRow = [
      data.timestamp,
      data.turma,
      data.numero,
      data.aluno,
      data.email,
      ...respObj,
      ...correcaoIA.notas, // Respostas corrigidas pela IA (Ex: "Atingida" ou "Não Atingida")
      correcaoIA.statusGeral,
      correcaoIA.apontamentos
    ];

    sheet.appendRow(newRow);
    
    // Atualizar Gráficos passando a escola
    atualizarGraficos(ss, data.escola);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Respostas registradas e corrigidas com sucesso!' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Simula ou chama a API do Gemini para corrigir as questões de acordo com o Guia Priorizado SP
 */
function corrigirComIA(respostasDiscursivas) {
  const prompt = `
    Você é um professor de Ciências avaliando alunos do 6º ano de acordo com o Guia Priorizado do Estado de São Paulo.
    Avalie as seguintes 5 respostas discursivas sobre: Hipótese/Teoria, Big Bang, Planetas, Atmosfera Primitiva e Tempo Geológico.
    Para cada resposta, determine se a habilidade foi "Atingida" ou "Não Atingida".
    Baseie-se na clareza científica e nos conceitos do currículo paulista.
    
    Respostas do Aluno:
    1. ${respostasDiscursivas[0]}
    2. ${respostasDiscursivas[1]}
    3. ${respostasDiscursivas[2]}
    4. ${respostasDiscursivas[3]}
    5. ${respostasDiscursivas[4]}

    Retorne APENAS um JSON no formato:
    {
      "notas": ["Atingida", "Atingida", ...],
      "apontamentos": "Texto resumido com dicas pedagógicas para o aluno sobre as competências não atingidas."
    }
  `;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }]
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const jsonRes = JSON.parse(response.getContentText());
    const candidates = jsonRes.candidates[0].content.parts[0].text;
    
    // Limpar possíveis marcações de markdown do JSON
    const cleanJson = candidates.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanJson);
    
    const atingidasCount = result.notas.filter(n => n === 'Atingida').length;
    result.statusGeral = `${atingidasCount}/5 Habilidades Atingidas`;
    
    return result;
  } catch (e) {
    // Fallback caso a API falhe
    return { 
      notas: ["Erro IA", "Erro IA", "Erro IA", "Erro IA", "Erro IA"], 
      statusGeral: "Erro na correção automática",
      apontamentos: "Não foi possível gerar apontamentos no momento."
    };
  }
}

/**
 * Cria ou atualiza a aba de Gráficos com gráficos de rosca por turma
 */
function atualizarGraficos(ss, escola) {
  let mainSheetName = 'ATIVIDADES 6ªANO LYDIA';
  let graphSheetName = 'Gráficos - Lydia';
  let turmas = ['6ºAno A', '6ºAno B', '6ºAno C'];

  if (escola === 'Wanda') {
    mainSheetName = 'ATIVIDADES 6ªANO WANDA MASCAGNI';
    graphSheetName = 'Gráficos - Wanda';
    turmas = ['6ºAno B', '6ºAno C'];
  }

  let graphSheet = ss.getSheetByName(graphSheetName);
  if (!graphSheet) {
    graphSheet = ss.insertSheet(graphSheetName);
  } else {
    graphSheet.clear();
    // Remover gráficos antigos
    const charts = graphSheet.getCharts();
    charts.forEach(c => graphSheet.removeChart(c));
  }

  const dataSheet = ss.getSheetByName(mainSheetName);
  if (!dataSheet) return;

  const values = dataSheet.getDataRange().getValues();
  if (values.length <= 1) return; // Só tem cabeçalho ou vazio
  const rawData = values.slice(1); // Remover cabeçalho

  let currentTitleRow = 1;

  turmas.forEach((turma, index) => {
    const turmaData = rawData.filter(r => r[1] === turma);
    if (turmaData.length === 0) return;

    let totalAtingidas = 0;
    let totalNaoAtingidas = 0;

    turmaData.forEach(row => {
      // Analisar colunas de Q6 a Q10 (índices 10 a 14)
      for (let i = 10; i <= 14; i++) {
        if (row[i] === 'Atingida') totalAtingidas++;
        else totalNaoAtingidas++;
      }
    });

    // Escrever dados para o gráfico na aba de gráficos (escondido ou lateral)
    const startRow = currentTitleRow + 1;
    graphSheet.getRange(currentTitleRow, 1).setValue(`Resumo de Habilidades - ${turma}`).setFontWeight('bold');
    graphSheet.getRange(startRow, 1).setValue('Status');
    graphSheet.getRange(startRow, 2).setValue('Quantidade');
    graphSheet.getRange(startRow + 1, 1).setValue('Atingidas');
    graphSheet.getRange(startRow + 1, 2).setValue(totalAtingidas);
    graphSheet.getRange(startRow + 2, 1).setValue('Não Atingidas');
    graphSheet.getRange(startRow + 2, 2).setValue(totalNaoAtingidas);

    // Criar Gráfico de Rosca
    const chart = graphSheet.newChart()
      .setChartType(Charts.ChartType.PIE)
      .addRange(graphSheet.getRange(startRow + 1, 1, 2, 2))
      .setPosition(currentTitleRow, 4, 0, 0)
      .setOption('title', `Habilidades ${turma}`)
      .setOption('pieHole', 0.4) // Efeito Rosca
      .setOption('colors', ['#4CAF50', '#F44336'])
      .build();

    graphSheet.insertChart(chart);
    currentTitleRow += 15; // Pular espaço para o próximo gráfico
  });
}
