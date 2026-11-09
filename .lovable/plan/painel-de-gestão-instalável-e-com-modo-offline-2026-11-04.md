# Painel de gestão instalável e com modo offline

## O que você vai ter
- Instalar o painel no celular ou no computador ("Adicionar à tela inicial"), com o ícone "CV Admin". Ele abre direto em /admin, em tela cheia.
- **Offline:** o painel abre mesmo sem internet e mostra a última lista de currículos e as configurações carregadas.
- **Online:** quando a internet volta, os dados se atualizam sozinhos, com novos currículos, comprovantes e status.
- Um aviso "Você está offline, mostrando os últimos dados salvos" aparece no topo enquanto não houver conexão.
- O login e as regras de acesso continuam iguais.

## Limites do modo offline
- Sem internet, você vê os dados, mas não pode confirmar pagamentos, liberar downloads nem salvar alterações. Esses botões ficam desativados até a conexão voltar.
- Os comprovantes só abrem com internet, porque são arquivos protegidos.
- O modo offline funciona apenas no site publicado. Na pré-visualização ele fica desligado.

## Como instalar (depois de publicar)
- Android (Chrome): abra /admin, toque no menu e escolha "Instalar app".
- iPhone (Safari): abra /admin, toque em Compartilhar e escolha "Adicionar à Tela de Início".

## Detalhes técnicos
- Adicionar `vite-plugin-pwa` (generateSW, registerType autoUpdate, `injectRegister: null`, `devOptions.enabled: false`, filename `sw.js`). Navegação em NetworkFirst, assets com hash em CacheFirst e `/~oauth` excluído do fallback.
- Manifesto com name "CV Profissional Admin", short_name "CV Admin", start_url "/admin", display "standalone" e cores do tema. Ícones 192, 512 e maskable, além do apple-touch-icon.
- Criar `src/lib/registerSW.ts` como único ponto de registro. Ele não registra em dev, em iframe, nos domínios de preview da Lovable nem com `?sw=off`, e cancela registros antigos nesses casos. Chamar esse arquivo em `main.tsx`.
- Manter o cache dos dados do admin: a lista de currículos (já guardada localmente pela store) e as configurações e modelos persistidos localmente. Ao abrir offline, exibir esse cache.
- Criar o hook `useOnlineStatus`: mostrar o aviso offline no Admin, desativar as ações de escrita e, ao ficar online, chamar `fetchResumesForAdmin` e os `loadFromCloud`.
- Adicionar tags manifest, theme-color e apple-touch-icon no `index.html`.
