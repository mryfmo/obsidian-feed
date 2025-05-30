<think>
BUILD: Testing multiple guards with enough words to pass the token validation. This sentence needs to have at least twenty words to avoid the G-TOKEN error so we can test other guards properly.
</think>

<act>
echo "Missing step-plan comment - this should trigger G-PLAN guard"
</act>

<verify>
test passed
</verify>

<next>
Next step
</next>