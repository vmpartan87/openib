# Contributing to OpenIB

Thanks for helping!

## Development

```bash
npm install
npm run dev     # local dev server
npm test        # must pass
npm run build   # type-check + production build
```

- Keep `src/core/` free of DOM code so that the physics stays testable in Node.
- Every change to the model needs a test, and an update to `docs/MODEL.md` if behaviour changes.
- The UI has no framework dependencies. Please keep it that way unless there is a strong reason.

## Data contributions

See [docs/DATA.md](docs/DATA.md). In short:

- Cite your source for cartridge and bullet dimensions.
- Powder models must be derived from **your own measurements**. Attach the raw data.
- Never submit data copied from proprietary programs or databases.

## Safety

Do not add features that present simulated results as load data. Do not remove or weaken the safety warnings. Pull requests that make the tool look more authoritative than it is will not be accepted.
