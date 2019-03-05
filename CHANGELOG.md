# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.15] - 2019-03-04
### Fixed
 - Issue where `EventEmitter`s were capped at 10 listeners. They no longer have an upper limit (hopefully there isn't a memory leak...)

## [0.1.14] - 2019-03-02
### Changed
 - Updated to latest `brs` version that:
    - allows `then` to be used as object property names
    - allows `function` to be used as a parameter type

## [0.1.13] - 2019-02-25
### Fixed
 - Issue that was showing duplicate errors when file was included in multiple components ([#10](https://github.com/TwitchBronBron/brightscript-language/issues/10))

### Misc
 - Accidentally called this release 0.1.13, when it was intended to be 0.1.3. 

## [0.1.2] - 2019-02-25
### Changed
 - Updated installation instructions. 
 - Reduced npm package install size (removed test files from `dist` folder)

## 0.1.1 - 2019-02-25
Initial project release. 

[0.1.15]: https://github.com/TwitchBronBron/brightscript-language/compare/v0.1.14...v0.1.15
[0.1.14]: https://github.com/TwitchBronBron/brightscript-language/compare/v0.1.13...v0.1.14
[0.1.13]: https://github.com/TwitchBronBron/brightscript-language/compare/v0.1.2...v0.1.13
[0.1.2]: https://github.com/TwitchBronBron/brightscript-language/compare/v0.1.1...v0.1.2