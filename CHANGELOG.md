# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).



### [0.1.23] - 2019-03-14
### Fixed
 - `command-line-usage` and `command-line-args` were both moved to dependencies so the cli will work. v0.1.22 did the wrong thing, this fixes it.



### [0.1.22] - 2019-03-14
### Changed
 - Completion provider now provides all in-scope variables instead of variables only at or above the cursor
### Fixed
 - moved `command-line-args` from devDependencies to dependencies so that the cli is runnable when installed.



### [0.1.21] - 2019-03-12
### Added
 - the ability to supress warnings and errors on a per-line basis with `brs:disable-next-line` and `brs:disable-line`. 



### [0.1.20] - 2019-03-11
### Fixed
 - targeted EXACTLY brs@0.13.0-nightly.20190310 to fix a weird npm dependency issue that is resolving to 0.13.0-rc.3 for some reason.



### [0.1.19] - 2019-03-10
### Fixed
 - Upgraded to brs@0.13.0-nightly.20190310 to fix RHS boolean assignment parse errors (see [this issue](https://github.com/sjbarag/brs/issues/156))
 - LanguageServer
   - hover bug in multi-root workspace that was only showing hovers for the first workspace
   - support loading brsconfig.json path as a setting from a connected languageclient (i.e. vscode)
   - reload workspace if brsconfig.json has changed



## [0.1.18] - 2019-03-08
### Fixed
 - issue where only top-level variables were being found. Now all variables are found throughout the entire function scope.  
 - runtime error when getting hover result.
 - issue with hover that would not find top-level function parameter types.


## [0.1.17] - 2019-03-08
### Fixed
 - Upgraded to brs@0.13.0-nightly.20190307 which fixed assignment operator parse errors. ([see this issue](https://github.com/sjbarag/brs/issues/173)).



## [0.1.16] - 2019-03-06
### Fixed
 - Upgraded to brs@0.13.0-nightly.20190306 which fixed the mixed-case `Then` regression ([see this issue](https://github.com/sjbarag/brs/issues/187)).



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



[0.1.23]: https://github.com/TwitchBronBron/brightscript-language/compare/v0.1.22...v0.1.23
[0.1.22]: https://github.com/TwitchBronBron/brightscript-language/compare/v0.1.21...v0.1.22
[0.1.21]: https://github.com/TwitchBronBron/brightscript-language/compare/v0.1.20...v0.1.21
[0.1.20]: https://github.com/TwitchBronBron/brightscript-language/compare/v0.1.19...v0.1.20
[0.1.19]: https://github.com/TwitchBronBron/brightscript-language/compare/v0.1.18...v0.1.19
[0.1.18]: https://github.com/TwitchBronBron/brightscript-language/compare/v0.1.17...v0.1.18
[0.1.17]: https://github.com/TwitchBronBron/brightscript-language/compare/v0.1.16...v0.1.17
[0.1.16]: https://github.com/TwitchBronBron/brightscript-language/compare/v0.1.15...v0.1.16
[0.1.15]: https://github.com/TwitchBronBron/brightscript-language/compare/v0.1.14...v0.1.15
[0.1.14]: https://github.com/TwitchBronBron/brightscript-language/compare/v0.1.13...v0.1.14
[0.1.13]: https://github.com/TwitchBronBron/brightscript-language/compare/v0.1.2...v0.1.13
[0.1.2]: https://github.com/TwitchBronBron/brightscript-language/compare/v0.1.1...v0.1.2