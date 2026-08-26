"""Base model for every request and response schema.

The API speaks camelCase while the database and Python layers stay in
snake_case; the alias generator is the single place that bridges the two.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        str_strip_whitespace=True,
    )
