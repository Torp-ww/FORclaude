# Шагомер

Фоновая запись и напоминания работают только в собственной сборке, не в Expo Go.

## Android (проще всего)
1. `npm install -g eas-cli`, затем `eas login` (бесплатный аккаунт на expo.dev).
2. `npm install`
3. `eas build --profile preview --platform android` — через 10–20 минут будет ссылка на APK.
4. Откройте ссылку на телефоне, установите APK.
5. В настройках телефона для «Шагомер» выберите геолокацию «Всегда» и отключите экономию батареи.

## iPhone
Нужна учётная запись Apple Developer. `eas build --profile preview --platform ios` (после `eas device:create`).

## Тест логики
`npm test`

## APK без Android Studio и без аккаунта Expo (GitHub Actions)
1. Создайте на github.com пустой репозиторий (можно приватный).
2. Загрузите в него содержимое этой папки (кнопка Add file → Upload files; папку `.github` тоже).
3. Откройте вкладку Actions → Build APK → Run workflow.
4. Через 10–15 минут откройте завершённый запуск, внизу в Artifacts скачайте `shagomer-apk`, распакуйте zip и установите `app-release.apk` на телефон (разрешите установку из неизвестных источников).
