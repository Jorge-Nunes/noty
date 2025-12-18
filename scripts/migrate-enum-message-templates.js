const { sequelize } = require('../config/database');

async function addEnumValueIfMissing(enumTypeName, value) {
  const checkSql = `
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = :enumTypeName
      AND e.enumlabel = :value
    LIMIT 1;
  `;

  const [rows] = await sequelize.query(checkSql, {
    replacements: { enumTypeName, value },
  });

  if (rows.length > 0) {
    console.log(`✅ Valor já existe no enum ${enumTypeName}: ${value}`);
    return false;
  }

  const alterSql = `ALTER TYPE "${enumTypeName}" ADD VALUE IF NOT EXISTS '${value}';`;
  // Nota: IF NOT EXISTS é suportado em PG >= 12. Mesmo sem, o nosso check evita erro.
  await sequelize.query(alterSql);
  console.log(`🆕 Adicionado ao enum ${enumTypeName}: ${value}`);
  return true;
}

async function showEnumValues(enumTypeName) {
  const [rows] = await sequelize.query(
    `SELECT enumlabel AS value
     FROM pg_type t
     JOIN pg_enum e ON t.oid = e.enumtypid
     WHERE t.typname = :enumTypeName
     ORDER BY e.enumsortorder;`,
    { replacements: { enumTypeName } }
  );
  console.log(`\n📋 Valores atuais do enum ${enumTypeName}:`);
  rows.forEach(r => console.log(` - ${r.value}`));
}

async function migrate() {
  const enumTypeName = 'enum_message_templates_type';
  const valuesToEnsure = [
    'traccar_warning_threshold',
    'traccar_warning_final',
  ];

  try {
    console.log('🚀 Iniciando migração de enum para message_templates.type...');

    // Verifica se o tipo existe
    const [typeExists] = await sequelize.query(
      `SELECT 1 FROM pg_type WHERE typname = :enumTypeName LIMIT 1;`,
      { replacements: { enumTypeName } }
    );
    if (typeExists.length === 0) {
      console.error(`❌ Tipo ${enumTypeName} não encontrado. Confirme o nome do tipo do ENUM da coluna message_templates.type.`);
      console.error('   Dica: Em muitos ambientes Sequelize usa nomes como enum_<tabela>_<coluna>.');
      process.exit(1);
    }

    let changed = false;
    for (const v of valuesToEnsure) {
      const added = await addEnumValueIfMissing(enumTypeName, v);
      if (added) changed = true;
    }

    await showEnumValues(enumTypeName);

    console.log(`\n✅ Migração concluída${changed ? ' com alterações' : ' (nada a alterar)'}.`);
  } catch (err) {
    console.error('💥 Falha na migração:', err.message || err);
    process.exit(1);
  } finally {
    await sequelize.close().catch(() => {});
  }
}

if (require.main === module) {
  migrate();
}

module.exports = { migrate };
