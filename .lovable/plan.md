## Plano: Corrigir preços inventados da Blue na base de conhecimento

### Problema

A Amélia está citando uma tabela de preços fictícia (Starter R$297, Silver R$497, etc.) porque existem **chunks e seções** na base de conhecimento com dados errados. A política comercial real da Blue tem planos completamente diferentes.

### Dados reais (PDF 2026)


| Produto                                 | Preço             | Descrição                                                                                                                                                                                                      |
| --------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IR Cripto - Licença Sistema Blue Cripto | R$ 998            | Carteiras/exchanges ilimitadas, até 25k transações/ano, porém é uma licença de sistea, ou seja, o cliente faz tudo e nós teos contadores experientes de suporte, mas a operacionalização é toda com o cliente. |
| IR Cripto - Diamond                     | R$ 2.997          | Até 4 carteiras/exchanges, até 25k transações/ano                                                                                                                                                              |
| IR Cripto - Gold                        | R$ 4.497          | Carteiras/exchanges ilimitadas, até 25k transações/ano                                                                                                                                                         |
| Pacote 5k operações adicionais          | R$ 500            | Upgrade de limite                                                                                                                                                                                              |
| Apuração de dependentes                 | R$ 500/dependente | Dependente investidor do titular                                                                                                                                                                               |
| Upgrade Diamond → Gold                  | R$ 1.500          | Upgrade de plano                                                                                                                                                                                               |
| Sistema de apuração                     | R$ 997            | 12 meses de acesso                                                                                                                                                                                             |
| IR Simples (sem cripto)                 | R$ 300            | IR simples sem apuração de criptoativos                                                                                                                                                                        |
| Consultoria Geral                       | R$ 1.200/hora     | Com Mychel Mendes ou especialistas                                                                                                                                                                             |
| Consultoria Privacidade                 | R$ 1.500/hora     | Estratégia de privacidade                                                                                                                                                                                      |
| Consultoria G20                         | R$ 60.000/ano     | Consultoria em grupo, 12 meses                                                                                                                                                                                 |


**Pagamento**: Pix à vista, cripto, ou cartão até 12x sem juros.
**Descontos**: 10% cartão, 15% Pix/Cripto (alçada time comercial/CS).
**Venda proporcional**: (Valor/12) × meses + 10%.

### Ações

1. **Atualizar seção FAQ "Quanto custa?"** (`id: 4837ac7e`) — substituir conteúdo pelos planos reais
2. **Atualizar seção Pitch "Exemplo de conversa"** (`id: fdff3b5c`) — reescrever com valores corretos
3. **Deletar embeddings antigos** dessas 2 seções (`source_id` = `4837ac7e` e `fdff3b5c`)
4. **Inserir novos chunks** com o texto atualizado e correto para reindexação via RAG
5. **Criar chunk adicional** com regras comerciais (descontos, venda proporcional, serviços complementares)

### Observação técnica

Os embeddings vetoriais antigos precisam ser deletados e regenerados (via edge function `knowledge-embed` ou inserção direta). Sem isso, o RAG continuará encontrando os chunks com preços errados.