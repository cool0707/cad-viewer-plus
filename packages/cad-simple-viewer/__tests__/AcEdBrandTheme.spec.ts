import {
  acedApplyBrandTheme,
  acedBuildBrandThemeCss,
  acedGetBrandColors
} from '../src/theme/AcEdBrandTheme'
import { ML_THEME_CONFIG } from '../src/theme/theme.config'

describe('AcEdBrandTheme', () => {
  it('derives the Element Plus palette like Sass color.mix', () => {
    const css = acedBuildBrandThemeCss({
      primary: '#af61da',
      gradient: ['#ea60d4', '#9c62dc']
    })
    expect(css).toContain('--ml-brand: #af61da;')
    expect(css).toContain(
      '--ml-brand-gradient: linear-gradient(90deg, #ea60d4 0%, #9c62dc 100%);'
    )
    // 90 % white + 10 % #af61da
    expect(css).toContain('--el-color-primary-light-9: #f7effb;')
    // 80 % #af61da + 20 % black
    expect(css).toContain('--el-color-primary-dark-2: #8c4eae;')
    // Dark mode mixes with the Element Plus dark background (#141414).
    expect(css).toMatch(
      /html\.dark:root \{[^}]*--el-color-primary-light-9: #241c28;/
    )
  })

  it('accepts #rgb and rejects invalid colours', () => {
    expect(() =>
      acedBuildBrandThemeCss({ primary: '#f0a', gradient: ['#fff', '#000'] })
    ).not.toThrow()
    expect(() =>
      acedBuildBrandThemeCss({ primary: 'purple', gradient: ['#fff', '#000'] })
    ).toThrow(/Invalid theme colour/)
  })

  it('defaults to theme.config.ts and writes one style element', () => {
    expect(acedGetBrandColors().primary).toBe(ML_THEME_CONFIG.primary)

    const style = { id: '', textContent: '' }
    const head = { appendChild: jest.fn() }
    const doc = {
      head,
      getElementById: jest.fn(() =>
        head.appendChild.mock.calls.length ? style : null
      ),
      createElement: jest.fn(() => style)
    } as unknown as Document

    acedApplyBrandTheme(undefined, doc)
    acedApplyBrandTheme({ primary: '#123456' }, doc)
    expect(head.appendChild).toHaveBeenCalledTimes(1)
    expect(style.id).toBe('ml-brand-theme')
    expect(style.textContent).toContain('--ml-brand: #123456;')
    expect(acedGetBrandColors().gradient).toEqual(ML_THEME_CONFIG.gradient)
  })
})
