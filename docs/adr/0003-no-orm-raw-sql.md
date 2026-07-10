# 后端数据访问：裸 SQL，不使用 ORM

后端持久化用 `better-sqlite3`，数据访问直接用 prepared statements 裸 SQL，不引入 ORM（Sequelize/Drizzle/Prisma 等）。

理由：全项目仅一张 `ActivitySession` 表 + 一个运行中的 `ActiveSession` 内存态，SQL 极简；统计聚合（按日/周/月/年 GROUP BY 求和）用裸 SQL 最清晰最高效，ORM 反而要绕。单用户微查询下 ORM 的抽象层是纯负担，且 `better-sqlite3` 的同步 prepared statement 调用风格与 ORM 异步模型不契合。

偏离常识之处：许多人默认上 ORM。本决定是有意为之——当表结构稳定在单表、查询以聚合为主时，裸 SQL 的可读性优于 ORM 的查询构建器。若未来表结构扩张到多表关联复杂查询，可重新评估引入 ORM。
