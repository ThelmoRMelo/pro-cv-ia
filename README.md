# Próxima Página

Front-end de uma experiência para criar currículos, escolher entre três planos e administrar modelos e pedidos.

## Rodar localmente

```sh
npm install
npm run dev
```

Tecnologias: React, TypeScript, Vite, Lucide e `vite-plugin-pwa`.

## Rotas

- `/` — apresentação, formulário do candidato, galeria com 20 modelos demonstrativos por plano e etapa de checkout de prévia.
- `/admin` — painel responsivo de demonstração para visão geral, pedidos, modelos, planos/Pix e configurações.

## Integrações

- Planos, modelos, checkout e status do pedido usam o cliente Supabase e as RPCs do schema gerado.
- O admin exige autenticação e valida o papel `admin`; aprovação do Pix e liberação do PDF chamam RPCs independentes.
- Formulário, planos/modelos e listagem mínima de pedidos têm cache local para fallback offline. Escritas administrativas ficam bloqueadas sem conexão.
- O QR Code é obtido pelo caminho configurado no checkout; o bucket `pix-qr-codes` precisa permitir URL assinada para esse usuário.
- O PDF é criado no navegador por `html2canvas` + `jsPDF`, somente depois de o status remoto confirmar `approved` e `download_released`.
- A galeria local é usada como fallback quando não há modelos ativos publicados no Supabase. A importação de templates ainda precisa de um fluxo de Storage e cadastro administrativo.
- A criação do primeiro usuário administrador, as policies RLS e a configuração dos buckets devem estar prontas no Supabase antes da publicação.

O PWA cacheia o shell da aplicação. Dados pessoais do candidato, comprovantes e PDFs não são incluídos no cache do service worker.



Continue a implementação interrompida para exibir e persistir imagens de templates e QR Codes Pix. O frontend já foi conectado ao Storage e usa os buckets `template-references` e `pix-qr-codes`.

No Supabase, verifique se esses buckets existem e se as permissões permitem o fluxo esperado: o administrador autenticado pode enviar e substituir imagens; os clientes conseguem visualizar imagens de templates e o QR Code do plano no checkout. Para Pix, preserve o acesso privado usando URLs assinadas quando aplicável. Não abra permissões além do necessário e não altere regras de negócio ou dados existentes sem necessidade.

Confira também os caminhos legados que já estão salvos nos registros e confirme que continuem acessíveis. Depois, teste no painel administrativo e na landing page, em desktop e celular: exibição dos templates cadastrados, envio/substituição de um template, exibição do QR Code Pix, cópia do código Pix e carregamento do checkout. Por fim, confirme que o endereço publicado corresponde ao projeto Próxima Página e informe se é necessário publicar uma nova versão para que o frontend atualizado entre no ar.

Não recrie nem apague imagens existentes. Se algum bucket ou política já estiver configurado, preserve-o e ajuste somente o que estiver faltando.






# TAREFA: FINALIZAÇÃO DA ETAPA 2 — EDITOR VISUAL MANUAL DE TEMPLATES DE CURRÍCULO

Você está trabalhando no projeto "Próxima Página", uma aplicação web em React 18, Vite 5, Tailwind CSS e TypeScript.

O backend (banco de dados e Storage) já foi preparado: a tabela `templates` já possui as colunas `creation_type` (text: 'ai' | 'manual' | null), `clean_background_url` (text) e `template_schema` (jsonb), e o bucket do Storage `template-references` já está funcional.

A lógica interna do editor e o compilador já foram criados nos seguintes arquivos:
1. `src/types/templateSchema.ts` — contrato de dados (versão 2), tipos dos elementos (field, text, icon, shape, photo), constantes A4 (794×1123px), lista de campos `CANDIDATE_FIELDS` e função `templateConfigState(t)`.
2. `src/lib/templateCompiler.ts` — compila o schema JSON + Imagem 2 (fundo limpo) em HTML puro para `generated_html` com tags `{{campo}}`, estilos inline e cálculo de overflow.
3. `src/lib/templatePersistence.ts` — função `saveManualTemplate()` que persiste imagens no bucket via `persistImageSource`, atualiza o registro na tabela `templates` com `creation_type = 'manual'` e remove arquivos em caso de rollback.
4. `src/ManualTemplateEditor.tsx` — componente completo com drag-and-drop, redimensionamento com 8 alças, camadas, alinhamento, gabarito da Imagem 1 com transparência ajustável, upload da Imagem 2 e modal de teste com candidato fictício.

---

### O QUE VOCÊ DEVE EXECUTAR (3 TAREFAS CIRÚRGICAS):

#### 1. Estilização do Editor Visual (`src/index.css`)
O componente `src/ManualTemplateEditor.tsx` usa classes com prefixo `.mte-*`. Adicione as regras CSS necessárias no `src/index.css` para que a interface fique elegante, profissional e alinhada à paleta visual do projeto (`#244b3e`, `#1b3a30`, `#f5f7f6`, bordas sutis e tipografia limpa):
- `.mte-shell`: modal fullscreen com z-index alto (9999), layout flex/grid ocupando 100vw e 100vh, fundo escuro/cinza moderno (`#1a1d1b` ou `#212523`).
- `.mte-top`: barra superior com título do modelo, botões de ação (Desfazer, Refazer, Zoom, Slider de transparência do gabarito, toggle do Fundo Limpo, Testar e botão "Salvar modelo").
- `.mte-body`: container principal dividido em três colunas (Painel esquerdo de elementos, Palco central de edição e Painel direito de propriedades/camadas).
- `.mte-library`: barra lateral esquerda com abas ou seções para adicionar Campos do Candidato, Textos livres, Ícones, Formas e Foto. Itens arrastáveis/clicáveis.
- `.mte-stage`: área central com rolagem livre e fundo neutro quadriculado ou suave para contraste.
- `.mte-page-wrap` e `.mte-page`: folha A4 proporcional (794px × 1123px) com sombra, escala via `transform: scale(zoom)` e fundo branco.
- `.mte-el` e `.mte-el.selected`: elemento na folha com contorno de seleção suave quando ativo.
- `.mte-handle`: as 8 alças de redimensionamento (`nw`, `n`, `ne`, `e`, `se`, `s`, `sw`, `w`) centralizadas nas bordas e vértices.
- `.mte-inspector`: barra lateral direita com controles de posição, dimensões, rotação, tipografia (família, tamanho, cor, peso, alinhamento, espaçamento, caixa alta/baixa), controles de foto (moldura, zoom, posição horizontal/vertical) e lista de camadas.
- `.mte-ref`: imagem de gabarito (Imagem 1) sobreposta na folha com `pointer-events: none` e opacidade controlada pelo slider.
- `.mte-test`: modal de teste com pré-visualização do currículo preenchido e indicadores de aviso se o texto exceder a caixa delimitadora.
- `.mte-mobile-bar`: barra inferior de alternância para telas menores.

#### 2. Integração no Painel Administrativo (`src/AdminPanel.tsx`)
1. Atualize o tipo `AdminTemplate` para conter os novos campos:
   ```ts
   export type AdminTemplate = {
     id: string;
     name: string;
     color: string;
     layout: number;
     preview_url?: string;
     generated_html?: string | null;
     clean_background_url?: string | null;
     template_schema?: unknown;
     creation_type?: string | null;
   };

No carrossel de modelos da aba "Modelos":
Use templateConfigState(item) (importado de ./types/templateSchema) ou verifique item.creation_type:
Se creation_type === 'manual' e tem generated_html: exiba o badge <span className="template-badge ready"><Palette size={12}/> Manual pronto</span> e o botão <button
type="button" className="template-manual-btn" onClick={()=>setEditingManual(item)}><Pencil size={13}/> Editar no editor manual</button>.
Se creation_type === 'ai' e tem generated_html: exiba <span className="template-badge ready"><CheckCircle2 size={12}/> IA pronta</span>.

Se estiver pendente (!item.creation_type ou !item.generated_html): exiba <span className="template-badge pending"><Sparkles size={12}/> Pendente</span> e dê as duas opções ao administrador:
O botão existente: Gerar HTML com IA
O novo botão: <button type="button" className="template-manual-btn" onClick={()=>setEditingManual(item)}><Palette size={13}/> Criar manualmente</button>
Gerencie o estado const [editingManual,
setEditingManual] = useState<AdminTemplate | null>(null);.
Quando editingManual não for nulo, renderize o editor:
{editingManual && (
  <ManualTemplateEditor
    template={editingManual}
    onClose={() => setEditingManual(null)}
    onSaved={(saved) => {
      // Atualiza o item localmente no painel
      setEditingManual(null);
      onUpdateTemplateLocal?.(saved);
    }}
    notify={notify}
  />
)}

Conexão no src/App.tsx
Na consulta inicial que busca os templates (supabase.from('templates').select(...)):
Altere a query para incluir as colunas adicionais: select('id, name, category, preview_url, generated_html, clean_background_url, template_schema, creation_type, is_active')
Mapeie esses três campos para o objeto de cada template armazenado no estado templateCatalog.
Adicione ou atualize a função de callback passada para o AdminPanel para que, ao salvar no ManualTemplateEditor, o templateCatalog seja atualizado em memória e no cache local (cacheTemplateCatalog) com o novo generated_html, clean_background_url, template_schema e creation_type = 'manual', refletindo instantaneamente tanto no painel quanto na galeria do candidato sem exigir recarregamento de página.
RESTRIÇÕES E DIRETRIZES TÉCNICAS OBRIGATÓRIAS:
NÃO use aliases com @/ nos imports: O projeto resolve módulos via caminhos relativos (ex.: use ./lib/templateCompiler, nunca @/lib/templateCompiler).
NÃO crie um segundo motor de renderização de PDF ou prévia: O CandidateResumePreview.tsx e a geração de PDF via html2canvas já consomem template.generated_html. O templateCompiler.ts já gera exatamente o HTML esperado por esse pipeline. Mantenha essa compatibilidade intacta.
NÃO altere tabelas nem crie migrations: O banco de dados já possui todos os campos e constraints necessários.
Valide o build: Certifique-se de que o código TypeScript compila sem erros (npm run build ou tsc --noEmit).
