# Winwidget — frontend

Frontend-приложение коммерческого сервиса Winwidget: публичный сайт, авторизация,
личный кабинет, административная панель, настройка виджетов, единая страница
заявок и публичные страницы предпросмотра.

Приложение построено на Next.js 14 с App Router, использует архитектуру
Feature-Sliced Design (FSD), адаптированную под Next.js App Router, и
взаимодействует с backend через HTTP API.

## Технологический стек

### Основные технологии

- `Next.js 14` и App Router;
- `React 18`;
- `TypeScript`;
- `TanStack React Query`;
- `Axios`;
- `Zustand`;
- `React Hook Form`;
- `libphonenumber-js`.

### UI и стилизация

- `Tailwind CSS 3`;
- `SCSS Modules` и `Sass`;
- `PostCSS` и `Autoprefixer`;
- `clsx`;
- `TipTap`;
- `Chart.js` и `react-chartjs-2`;
- `react-loading-skeleton`;
- `react-hot-toast`.

### Авторизация и вспомогательные библиотеки

- `jose`;
- `js-cookie`;
- `qrcode`;
- `sharp`.

### Качество кода и инфраструктура

- `ESLint` с `next/core-web-vitals` и `jsx-a11y/recommended`;
- `Prettier`;
- `Husky` и `lint-staged`;
- `Node.js 20`;
- `pnpm 9`;
- `Docker` и Next.js standalone output.

---

# Архитектура проекта

Проект построен по Feature-Sliced Design с адаптацией под Next.js App Router.

Документация:
[Feature-Sliced Design Documentation](https://feature-sliced.design/ru/docs/get-started/overview)

## Структура слоёв

```text
src/
├── app/          # Next.js routes, layouts, metadata, providers и app shell
├── screens/      # композиции полноценных экранов
├── features/     # пользовательские сценарии и действия
├── entities/     # бизнес-сущности, их model, api и ui
├── shared/
│   ├── api/      # Axios clients, interceptors и token storage
│   ├── assets/   # общие изображения
│   ├── config/   # API и route config
│   ├── lib/      # независимые hooks, stores и helpers
│   ├── types/    # общие типы и глобальные декларации
│   └── ui/       # переиспользуемые UI-примитивы
└── middleware.ts # обязательная точка входа Next.js middleware
```

Направление зависимостей:

```text
app -> screens -> features -> entities -> shared
```

Стандартный FSD-слой `pages` заменён на `screens`, потому что маршрутизация
принадлежит Next.js App Router в `src/app`.

FSD-слой `widgets` намеренно не используется. В этом проекте слово «виджет»
уже обозначает продуктовую сущность Winwidget и отдельные runtime-скрипты,
поэтому архитектурный слой с тем же именем создавал бы двусмысленные пути и
нейминг. Крупные экранные композиции находятся в `screens`, бизнес-сущность —
в `entities/site-widget`, а пользовательские сценарии — в `features`. Набор
слоёв FSD может быть неполным; важны их границы и направление зависимостей.

## Основные slices

### Screens

- `admin`;
- `auth`;
- `cabinet`;
- `home`;
- `legal-documentation`;
- `payment`;
- `widget-leads`;
- `widget-preview`.

### Entities

- `affiliate`;
- `home-page-content`;
- `legal-page`;
- `note`;
- `site-settings`;
- `site-widget`;
- `subscription`;
- `user`.

### Features

- `admin-monitoring`;
- `auth`;
- `bind-profile-identity`;
- `campaigns`;
- `cookie-consent`;
- `create-widget`;
- `edit-profile`;
- `edit-widget-settings`;
- `manage-payments`;
- `manage-subscriptions`;
- `manage-telegram-bot`;
- `manage-users`;
- `manage-widgets`;
- `mobile-navigation`;
- `network-status`;
- `run-admin-task`;
- `upload-file`;
- `view-event-log`.

## Правила архитектуры

- Нижний слой не импортирует верхний.
- Slices одного слоя не зависят друг от друга напрямую.
- Внешний код импортирует slice через его публичный API.
- Связи между entities оформляются через явный cross-import API в `@x`.
- `shared` не зависит от бизнес-логики.
- Доменные типы находятся в соответствующей entity или feature.
- Базовая HTTP-инфраструктура находится в `shared/api`.
- Доменные запросы находятся в `api` соответствующего slice.
- Server-only модули не импортируются в Client Components.
- Query keys, queries и mutations размещаются рядом с владельцем данных.
- Циклические зависимости запрещены.

Server entrypoints и server actions экспортируются отдельно от клиентского
`index.ts`, например через `server.ts` и `actions.ts`. Это не позволяет
случайно включить server-only код в клиентский bundle.

## Next.js routes

`src/app` отвечает за URL, layouts, metadata и инициализацию приложения.
Route-файлы остаются тонкими и подключают экраны из `src/screens`.

Публичные preview-маршруты:

- `/page-wheel/[key]`;
- `/page-quiz/[key]`;
- `/page-callback/[key]`;
- `/page-timer/[key]`;
- `/page-stop-offer/[key]`;
- `/page-online-consultant/[key]`;
- `/page-calculator/[key]`.

Все типы виджетов используют единую композицию страницы заявок в
`screens/widget-leads`.

---

# Установка и запуск

## Требования

- Node.js 20;
- pnpm 9;
- запущенный API Gateway на `http://localhost:4100` и сервисы из его локального
  route manifest; Widgets API/assets по умолчанию доступны на
  `http://localhost:4700`.

## Установка зависимостей

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile
```

## Настройка окружения

```bash
cp .env.example .env.local
```

Для авторизованных маршрутов настройте серверную проверку access token:

```env
NEXT_PUBLIC_API_URL=http://localhost:4100/api/v1
JWT_JWKS_URL=http://localhost:4100/api/v1/auth/.well-known/jwks.json
JWT_ISSUER=http://localhost:4100/auth
JWT_AUDIENCE=http://localhost:4100
JWT_CLOCK_TOLERANCE_SECONDS=5
JWT_MAX_TOKEN_LIFETIME_SECONDS=900
```

Значения issuer и audience должны совпадать с backend. Эти переменные
используются только Next.js middleware, поэтому не добавляйте к ним префикс
`NEXT_PUBLIC_`.

Gateway разрешает credentialed CORS только для точных development-origin
`http://localhost:3000` и `http://127.0.0.1:3000`. Поэтому весь локальный
versioned API идёт через `:4100`, а unversioned runtime-виджеты и preview —
через `NEXT_PUBLIC_WIDGETS_HOST=:4700`. Core endpoint и fallback отсутствуют.

## Запуск development-сервера

```bash
pnpm dev
```

Frontend будет доступен на
[http://localhost:3000](http://localhost:3000).

## Production build

```bash
pnpm build
pnpm start
```

## Переменные окружения

| Переменная                       | Назначение                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_MODE`               | Режим выбора адресов: `development` или `production`                                   |
| `NEXT_PUBLIC_SITE_URL`           | Публичный адрес frontend                                                               |
| `NEXT_PUBLIC_PRODUCTION_HOST`    | Публичный адрес production backend                                                     |
| `NEXT_PUBLIC_WIDGETS_HOST`       | Адрес Widgets Service; по умолчанию `:4700` локально и production backend в production |
| `NEXT_PUBLIC_API_URL`            | Полный базовый URL API с `/api/v1`                                                     |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Публичный ключ reCAPTCHA v3                                                            |
| `NEXT_PUBLIC_RECAPTCHA_HOST`     | Хост загрузки reCAPTCHA                                                                |
| `JWT_JWKS_URL`                   | Server-only URL набора публичных RS256-ключей backend                                  |
| `JWT_ISSUER`                     | Server-only ожидаемый issuer access token; должен совпадать с backend                  |
| `JWT_AUDIENCE`                   | Server-only ожидаемый audience access token; должен совпадать с backend                |
| `JWT_CLOCK_TOLERANCE_SECONDS`    | Server-only допустимое расхождение часов, целое число секунд от `0` до `60`            |
| `JWT_MAX_TOKEN_LIFETIME_SECONDS` | Server-only максимальное время жизни access token, от `60` до `1800` секунд            |

Не коммитьте реальные секреты. Переменные `NEXT_PUBLIC_*` встраиваются во
frontend во время сборки, поэтому после их изменения production image нужно
пересобрать. JWT-переменные без этого префикса остаются на сервере и передаются
в runtime-окружение frontend-контейнера.

## Команды

| Команда                  | Назначение                                  |
| ------------------------ | ------------------------------------------- |
| `pnpm dev`               | Запуск development-сервера                  |
| `pnpm build`             | Production-сборка                           |
| `pnpm start`             | Запуск предварительно собранного приложения |
| `pnpm lint`              | Проверка ESLint                             |
| `pnpm exec tsc --noEmit` | Проверка TypeScript без генерации файлов    |
| `pnpm format`            | Форматирование файлов через Prettier        |

`pnpm format` изменяет файлы.

---

# Работа с API и данными

- `shared/api` создаёт публичный и авторизованный Axios clients.
- Access token хранится в cookie `accessToken`.
- Next.js middleware проверяет access token только по RS256 через публичные ключи
  из JWKS. Приватный ключ подписи frontend не получает.
- Refresh выполняется через `/api/v1/auth/refresh` с защитой от параллельных
  дублирующих запросов. Backend при каждом успешном refresh ротирует opaque
  refresh token и возвращает новую cookie через `Set-Cookie`.
- Refresh cookie имеет флаг `HttpOnly`: браузерный JavaScript не может её
  прочитать. Axios отправляет cookie автоматически с `withCredentials`, а
  server-side middleware переносит полученный `Set-Cookie` в итоговый ответ.
- API конкретной бизнес-области находится внутри её entity или feature.
- Серверные запросы Next.js отделены от браузерных API-модулей.
- Запросы из UI выполняются через React Query hooks или API соответствующего
  slice.
- Не выполняйте необёрнутые HTTP-запросы непосредственно в UI-компонентах.

---

# Формы и уведомления

- Для форм используется React Hook Form.
- Типы, валидация и преобразование данных размещаются рядом с feature.
- Для телефонных полей используется `libphonenumber-js` и общий phone hook.
- Результаты пользовательских действий отображаются через `react-hot-toast`.
- Ошибки frontend и backend должны отображаться понятным пользователю
  текстом.

---

# Стили и изображения

## Стили

- Компонентные стили размещаются в SCSS Modules.
- Tailwind-директивы в SCSS оформляются через `@apply`.
- `tailwind.config.ts` сканирует весь `src`.
- Глобальные стили добавляются только при необходимости.
- После рефакторинга удаляйте неиспользуемые и остаточные стили.
- При кастомной стрелке `select` отключайте системную через
  `@apply appearance-none` и оставляйте достаточный правый отступ.

## SVG

Для оптимизации SVG использовать:

[SVGOMG](https://svgomg.net/privacy)

Рекомендуется удалять лишние metadata, уменьшать precision и включать cleanup
IDs.

## PNG

Для оптимизации PNG использовать:

[SVGOMG PNG Optimization](https://svgomg.net/privacy)

Перед добавлением изображений уменьшайте размер файлов, избегайте oversized
assets и по возможности используйте WebP или AVIF.

---

# Code style

- Используйте alias `@/*` для импортов из `src`.
- Следуйте существующим настройкам ESLint и Prettier.
- Не добавляйте `any` без обоснованной необходимости.
- Сохраняйте существующий naming и code style затрагиваемого slice.
- Не смешивайте UI, сетевые запросы, преобразование DTO и бизнес-правила в
  одном модуле без необходимости.
- Не создавайте глобальные utils и новые абстракции без практической пользы.

Перед commit Husky и lint-staged форматируют затронутые файлы и запускают
ESLint для TypeScript-кода.

---

# Проверки и тестирование

Минимальный набор проверок:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Перед релизом выполните ручной smoke-test:

- главной и публичных страниц;
- регистрации, входа, refresh и выхода;
- личного кабинета;
- создания, редактирования, включения и удаления каждого типа виджета;
- публичных preview-страниц;
- единой страницы заявок;
- критических разделов административной панели;
- оплаты и изменения подписки.

---

## Рекомендуемый формат веток

```bash
feature/auth-login
feature/cards-page
fix/header-layout
refactor/user-store
```

## Commit convention

```bash
feat: add transfer form
fix: resolve currency formatting issue
refactor: split card widget
```

# CI/CD и production

Workflow `.github/workflows/deploy-production.yml` запускается вручную или при
push в ветку `prod`.

Verify-этап выполняет:

```text
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm build
```

После успешной проверки deploy выполняется по SSH. Скрипт
`scripts/deploy-production.sh` собирает standalone Docker container и
проверяет healthcheck.

Production flow:

```text
локальные проверки
-> commit и push
-> GitHub Actions verify
-> GitHub Actions deploy
-> production smoke-test
```

Связанные файлы и каталоги:

- [`.env.example`](.env.example);
- [`Dockerfile`](Dockerfile);
- [`.github/workflows/deploy-production.yml`](.github/workflows/deploy-production.yml);
- [`scripts/deploy-production.sh`](scripts/deploy-production.sh);
- `../deploy/frontend` — production-конфигурация frontend;
- `../DOCUMENTATION` — общая документация проекта c аналитическими артефактами.
