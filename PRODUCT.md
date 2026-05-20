# Product

## Register

product

## Users

内部团队开发者，在集成 PayPal Vault 功能时用于测试各种支付流程。使用场景：配置凭证、选择测试用例、执行流程、确认结果。技术背景强，不需要引导式体验，需要的是快速定位和清晰反馈。

## Product Purpose

PayPal JSv5 Vault 测试工具站。覆盖 ACDC 卡支付、PayPal Smart Button、无购买保存卡/PayPal、纯 API Vault 五条流程。帮助开发者在接入生产前验证 vault 行为，确认配置正确、流程可通。

## Brand Personality

简单、高效、清晰

## Anti-references

- 营销网站风格：大渐变、动态 hero、装饰性插图
- Dashboard 堆砌：无意义的图表、KPI 卡片
- 过度设计的 UI：阴影叠阴影、圆角过大、色彩过多
- 模糊的状态反馈：不知道成功了还是失败了

## Design Principles

1. **测试用例优先**：首页导航必须让人一眼看清五条流程的区别，分类和标签是首要信息层级。
2. **配置回显是核心**：当前选择的 Client ID、Auth 模式、Vault ID、Customer ID 等配置必须随时可见，不能藏起来。
3. **结果要明确**：成功、失败、等待中——三种状态视觉上必须有显著区别，不能靠猜。
4. **零装饰噪音**：每个元素都有功能理由存在，去掉任何纯装饰性内容。
5. **配置路径清晰**：用户应该能在 30 秒内完成「选测试用例 → 配置参数 → 执行 → 看结果」的完整循环。

## Accessibility & Inclusion

内部工具，WCAG AA 基准即可。键盘可操作，颜色对比度达标（避免纯色依赖传达状态，需搭配文字或图标）。
