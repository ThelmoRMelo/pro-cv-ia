# Prompt de integração para o Lovable

Copie o texto abaixo para o Lovable depois de revisar o front-end.

---

O front-end do projeto já foi implementado. Agora conecte os fluxos existentes ao back-end do Lovable (Supabase), incluindo banco de dados, Storage, funções server-side e RLS. Preserve o desenho, os textos, componentes e responsividade atuais; substitua os dados demonstrativos por dados reais sem refazer a interface.

## Regras importantes

1. Não confie em preço, plano, status, papel de administrador, chave Pix, QR Code, conteúdo de currículo ou autorização recebidos do navegador. Revalide tudo no servidor.
2. Nunca exponha `service_role`, segredos de IA, chaves privadas ou credenciais administrativas no cliente.
3. A aprovação do pagamento e a liberação do PDF são ações distintas e exclusivamente administrativas. O clique do cliente em “Já fiz o Pix” não confirma pagamento.
4. Não apresente QR Code fictício ou estático como cobrança pagável. A tela de pagamento deve renderizar o QR Code cadastrado e validado para o plano selecionado. Como os preços atuais são muito baixos, use o valor configurado no servidor, sem recalcular ou confiar no navegador.
5. Não coloque dados pessoais ou currículos em cache público/offline. O service worker pode armazenar apenas o shell estático. Com internet indisponível, desative operações de escrita no admin e explique isso claramente.
6. Preserve as rotas `/` e `/admin`, a instalação PWA para o painel e os fluxos visuais existentes.

## Entidades necessárias

Crie migrações e tipos para:

- `profiles`: `id` ligado a `auth.users`, `display_name`, `role` (`admin` ou `customer`), timestamps. Só um administrador provisionado de forma segura pode conceder o papel `admin`; usuários não podem editar o próprio papel.
- `plans`: `id`, `slug` (`basico`, `intermediario`, `profissional`), `name`, `description`, `price_cents`, `currency` (`BRL`), `is_active`, `sort_order`, `features` JSON validado, timestamps. Valores iniciais: 200, 300 e 500 centavos, editáveis só por admin.
- `pix_configs`: `id`, `plan_id`, `recipient_name`, `pix_key`, `qr_code_object_path`, `is_active`, timestamps. Um admin pode atualizar. Clientes autenticados podem ler apenas os dados ativos necessários ao checkout. Não exponha arquivos arbitrários do Storage.
- `templates`: `id`, `plan_id`, `name`, `short_description`, `preview_object_path`, `source_object_path`, `render_config` JSON, `is_published`, `sort_order`, timestamps. Permitir pelo menos 20 templates por plano; arquivar sem apagar pedidos antigos. Validar mime type/tamanho dos uploads e guardar os originais em bucket privado. Pré-visualizações públicas só se aprovadas pelo admin e sem dados pessoais.
- `resume_orders`: `id`, `customer_id`, `plan_id`, `template_id`, `resume_data` JSON, `amount_cents` como snapshot do preço, `payment_status` (`pending`, `under_review`, `approved`, `rejected`, `refunded`), `fulfillment_status` (`locked`, `released`, `downloaded`), `payment_reference`, `payment_proof_object_path`, `pdf_object_path`, `created_at`, `updated_at`, `approved_by`, `approved_at`, `released_at`. O total, plano ativo e modelo pertencente ao plano são validados no servidor na criação do pedido.
- `order_events`: trilha append-only com `order_id`, ator, ação, status anterior/novo, timestamp e metadados mínimos para auditoria.

Se separar dados pessoais em uma tabela própria melhorar a privacidade, aplique a separação e mantenha a associação protegida pelo usuário autenticado.

## Acesso e RLS

- Ative RLS em todas as tabelas e buckets.
- Cliente autenticado pode criar pedido apenas para si; ler/atualizar somente seu próprio rascunho e seus próprios pedidos. Bloqueie alterações do cliente em `amount_cents`, plano/template fora da validação, status, aprovação, liberação e caminhos privados de arquivo. Depois do envio, trate `resume_data` como imutável ou permita edição apenas antes da submissão.
- Admin pode ler e gerir planos, Pix e templates; ler pedidos e comprovantes; aprovar/rejeitar; liberar downloads; cadastrar eventos. Use função de verificação de papel segura, sem recursão de RLS, e não permita que o próprio cliente altere `profiles.role`.
- Buckets separados: `template-sources` privado, `template-previews` com leitura apenas dos modelos publicados, `payment-proofs` privado, `generated-resumes` privado, e `pix-qr-codes` com leitura controlada conforme o checkout. Upload com MIME allowlist (PNG/JPEG/WebP/PDF conforme o fluxo), limite de tamanho e nomes opacos. Evite URLs públicas para comprovantes e PDFs.
- Comprovantes, currículos e PDFs devem ser entregues por URL assinada de curta duração, emitida após checar a identidade e status. Usuário só acessa seus arquivos; admin pode acessar para gestão.
- Não permita busca pública de pedidos nem exposição de e-mails, telefone ou conteúdo de currículo em listagens de admin que o cliente possa chamar.

## Operações server-side

Implemente funções RPC/Edge Functions com validação de esquema, autorização, idempotência e registro de eventos:

1. Criar/atualizar rascunho de currículo e criar pedido: confirmar usuário, plano ativo, template publicado vinculado ao plano e preço vigente; criar snapshot de valor; gerar referência aleatória não previsível.
2. Preparar checkout Pix: devolver só a chave/dados do recebedor e QR Code associados ao pedido/plano, junto com o valor snapshot. Se não houver QR Code configurado e compatível, bloquear checkout e orientar o admin.
3. Registrar aviso de pagamento: marcar pedido como `under_review` e guardar referência/comprovante opcional privado. Isso não aprova nem libera.
4. Admin aprovar/rejeitar pagamento e liberar download em ações auditadas separadas. Exija confirmação explícita na interface e verifique novamente o papel no servidor.
5. Gerar PDF após aprovação/liberação, usando `resume_data` validado e `render_config` do template. Faça processamento confiável no servidor. Não envie dados de currículo a provedor externo de IA sem consentimento explícito, política de retenção definida e segredos exclusivamente server-side. A imagem de referência do template serve para preparar o modelo no fluxo administrativo; para candidatos, renderize o template estruturado aprovado em PDF e substitua apenas os campos mapeados, sem copiar dados de pessoas presentes na imagem.
6. Emitir URL temporária de download somente para pedido aprovado e liberado, vinculado ao usuário correto; gravar evento de download. Não exponha o caminho do bucket.
7. Administrar planos, templates e Pix somente com papel admin; validar que o QR Code e o valor estão associados ao mesmo plano.

## Dados pessoais e currículo

O formulário atual coleta nome, e-mail, telefone, cidade/estado, LinkedIn/portfólio, objetivo/cargo, resumo, experiências, formação, competências e idiomas. Armazene apenas o necessário; valide comprimentos e tipos no cliente e servidor. Inclua consentimento claro para tratamento dos dados com finalidade de produzir e entregar o currículo, política de retenção/exclusão e canal de contato. Não inclua endereço residencial completo ou dados sensíveis por padrão.

## Conectar às telas atuais

- Landing: carregar planos ativos e templates publicados por modalidade; busca/seleção real de template; manter a quantidade mínima visível configurada pelo admin (20 por plano quando disponíveis); formulário com rascunho privado.
- Checkout: criar pedido no servidor, mostrar preço snapshot, chave/QR Code reais, instruções e status. Atualizar status por realtime ou polling leve. “Já fiz o Pix” apenas avisa o admin.
- Admin: exigir Supabase Auth antes de renderizar ou consultar dados do painel. Se não autenticado, mostrar login. Ligar métricas, tabela de pedidos, filtros, configuração de preços/Pix, importação de imagem/PDF, cadastro/edição/publicação de templates e identidade da landing às operações protegidas.
- Em pedidos pendentes, apresentar comprovante protegido e ações separadas “Aprovar pagamento” e “Liberar PDF”. A interface deve refletir estados do servidor, não estado local. Não deixar uma aprovação simulada ou um botão cliente liberar download.
- A tela final de download deve aparecer apenas após o servidor confirmar liberação; chamar a função que emite URL assinada e baixar o PDF renderizado.
- PWA: em `/admin`, mostrar aviso offline, servir apenas o shell e cache local de dados administrativos não sensíveis se necessário; não mostrar comprovantes/PDF offline. Desativar mutações offline. No retorno da conexão, revalidar pedidos e configurações. Não habilitar service worker na prévia Lovable ou em iframe.

## Critérios de aceite

- Usuário A não consegue ler nem alterar pedidos, comprovantes, dados pessoais ou PDFs de usuário B, inclusive via REST/RPC/Storage.
- Usuário comum não consegue ler dados administrativos, mudar preços/QR Code, publicar templates ou aprovar pedidos.
- Alterar o front-end, DevTools ou enviar chamadas manuais não permite mudar preço/status/liberação.
- QR Code e valor sempre correspondem ao plano e snapshot do pedido.
- Nenhum arquivo privado abre sem autorização e URL assinada válida.
- Só pedido aprovado e liberado gera/entrega PDF.
- O painel mobile e PWA continuam responsivos; offline nunca permite escrita e não expõe conteúdo sensível.
- Forneça migrações, políticas, funções, tipos, estados vazios/erro/carregamento e instruções de configuração de segredos. Não invente credenciais Pix ou de provedor.

Antes de alterar o front-end, explique qualquer mudança de contrato necessária. Depois conecte as telas existentes ao Supabase mantendo a identidade visual e apresente uma lista objetiva das tabelas, políticas, funções e variáveis secretas configuradas.
