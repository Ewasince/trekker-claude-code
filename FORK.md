# Форк trekker: установка плагина и дашборда без локальных файлов

Этот репозиторий — форк [obsfx/trekker-claude-code](https://github.com/obsfx/trekker-claude-code)
с фиксом MCP-сервера для Windows (`spawn trekker ENOENT`, см. `mcp-server/src/cli-runner.ts`).
Рядом живёт форк дашборда: [Ewasince/trekker-dashboard](https://github.com/Ewasince/trekker-dashboard).

Экосистема trekker состоит из трёх репозиториев:

| Что | Оригинал | Форк | Как ставится |
|---|---|---|---|
| CLI `trekker` | [obsfx/trekker](https://github.com/obsfx/trekker) | нет | `npm install -g @obsfx/trekker` |
| Плагин Claude Code (MCP + хуки + скиллы) | [obsfx/trekker-claude-code](https://github.com/obsfx/trekker-claude-code) | этот репозиторий | marketplace Claude Code |
| Дашборд | [obsfx/trekker-dashboard](https://github.com/obsfx/trekker-dashboard) | [Ewasince/trekker-dashboard](https://github.com/Ewasince/trekker-dashboard) | npm (нужен Bun) |

## Плагин для Claude Code

Marketplace в Claude Code — это любой git-репозиторий с `.claude-plugin/marketplace.json`.
В этом форке marketplace называется `ewasince-trekker`, а источник плагина указан как `./`
(корень этого же репозитория), поэтому один и тот же манифест работает и с локального клона,
и с GitHub.

### Из GitHub (целевой вариант)

Требование: изменения должны лежать в ветке `main` форка — marketplace ставится с ветки по умолчанию.

```
/plugin marketplace add Ewasince/trekker-claude-code
/plugin uninstall trekker@trekker-marketplace
/plugin install trekker@ewasince-trekker
```

Оригинальный marketplace `trekker-marketplace` можно удалить:
`/plugin marketplace remove trekker-marketplace`.

Обновление после новых коммитов в `main`:

```
/plugin marketplace update ewasince-trekker
/plugin update trekker@ewasince-trekker
```

### Из локального клона (пока фикс не смержен в main)

То же самое, но источник marketplace — путь к клону; ставится то, что сейчас выкачано в рабочее дерево:

```
claude plugin marketplace add C:\Users\ewas\WebstormProjects\trekker-claude-code
claude plugin uninstall trekker@trekker-marketplace
claude plugin install trekker@ewasince-trekker
```

После переключения ветки или новых коммитов в клоне: `claude plugin marketplace update ewasince-trekker`
и `claude plugin update trekker@ewasince-trekker`. Чтобы потом перейти на GitHub-вариант,
удалите локальный marketplace (`claude plugin marketplace remove ewasince-trekker`) и добавьте его из GitHub.

### Выпуск новой версии форка

1. Поднять версию в трёх местах: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
   (`plugins[0].version`), `mcp-server/package.json`. Без этого Claude Code не увидит обновление.
2. Пересобрать MCP-сервер, `dist/index.js` закоммичен и используется плагином как есть:
   ```
   cd mcp-server && pnpm install && pnpm build
   ```
3. Закоммитить, запушить, смержить в `main`.

### Переменная TREKKER_BIN

Если MCP не находит CLI (`trekker CLI not found in PATH`), укажите путь явно в окружении Claude Code:
`TREKKER_BIN=<npm prefix>/node_modules/@obsfx/trekker/bin/trekker.js` (или путь к нативному бинарнику).

## Дашборд

Пакет оригинала называется `@obsfx/trekker-dashboard`; под чужим scope публиковать нельзя.
Форк сейчас не содержит собранного `dist/` и скрипта `prepare`, поэтому `npm install` из git
поставит пустой пакет. Варианты, от простого к основательному:

1. **Установка из GitHub без публикации.** Добавить в `package.json` форка
   `"prepare": "bun run build"` — npm соберёт `dist` при установке из git. Затем:
   ```
   npm install -g github:Ewasince/trekker-dashboard#local-develop
   ```
   Bun нужен и для сборки, и для запуска.
2. **Публикация под своим scope.** Переименовать пакет в `@ewasince/trekker-dashboard`
   (`bin` оставить `trekker-dashboard`), `npm login`, `npm publish --access public`.
   Установка: `npm install -g @ewasince/trekker-dashboard`.
3. **GitHub Releases.** `npm pack`, приложить `.tgz` к релизу, ставить `npm install -g <url .tgz>`.
   Без аккаунта npm, но ручная сборка на каждый релиз.
